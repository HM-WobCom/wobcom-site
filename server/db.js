"use strict";

const fs = require("fs");
const path = require("path");

function getDbPath() {
  const fromEnv = process.env.DATABASE_PATH;
  if (fromEnv) return path.resolve(process.cwd(), fromEnv);
  return path.join(__dirname, "..", "data", "wobcom.db");
}

let dbInstance = null;
let SQLModule = null;

function persist(db) {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

async function initDb() {
  if (dbInstance) return dbInstance;

  const initSqlJs = require("sql.js");
  const wasmDir = path.join(__dirname, "..", "node_modules", "sql.js", "dist");
  SQLModule = await initSqlJs({
    locateFile: function (file) {
      return path.join(wasmDir, file);
    },
  });

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db;
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQLModule.Database(filebuffer);
  } else {
    db = new SQLModule.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS demo_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      business_name TEXT,
      message TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at ON demo_requests(created_at);`);

  persist(db);
  dbInstance = db;
  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    throw new Error("Database not initialized; call await initDb() first.");
  }
  return dbInstance;
}

function insertDemoRequest(row) {
  const db = getDb();
  db.run(
    `INSERT INTO demo_requests (name, email, phone, business_name, message, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.name,
      row.email,
      row.phone,
      row.business_name || null,
      row.message,
      row.ip_address || null,
      row.user_agent || null,
    ]
  );
  persist(db);

  const res = db.exec(
    `SELECT id, created_at FROM demo_requests WHERE id = (SELECT last_insert_rowid())`
  );
  if (!res.length || !res[0].values.length) {
    return { id: null, created_at: new Date().toISOString() };
  }
  const cols = res[0].columns;
  const vals = res[0].values[0];
  const out = {};
  cols.forEach(function (c, i) {
    out[c] = vals[i];
  });
  return out;
}

function listDemoRequests(limit) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 500, 1), 2000);
  const stmt = db.prepare(
    `SELECT id, name, email, phone, business_name, message, ip_address, user_agent, created_at
     FROM demo_requests
     ORDER BY datetime(created_at) DESC
     LIMIT ?`
  );
  stmt.bind([safeLimit]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

module.exports = {
  initDb,
  getDb,
  insertDemoRequest,
  listDemoRequests,
};
