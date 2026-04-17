"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");

const { initDb } = require("./db");
const { postDemoRequest } = require("./routes/demoRoutes");
const {
  requireAdmin,
  postLogin,
  postLogout,
  getSubmissions,
  getSessionStatus,
} = require("./routes/adminRoutes");

const app = express();
const rootDir = path.join(__dirname, "..");

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: "48kb" }));
app.use(express.urlencoded({ extended: true, limit: "48kb" }));

const sessionSecret = process.env.SESSION_SECRET || "dev-only-change-me";
if (process.env.NODE_ENV === "production" && sessionSecret === "dev-only-change-me") {
  console.warn("[security] Set SESSION_SECRET in production.");
}

app.use(
  session({
    name: "wobcom.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

var demoWindowMs = parseInt(process.env.DEMO_RATE_LIMIT_WINDOW_MS || "", 10);
if (!Number.isFinite(demoWindowMs) || demoWindowMs < 60000) {
  demoWindowMs = 15 * 60 * 1000;
}
var demoMax = parseInt(process.env.DEMO_RATE_LIMIT_MAX || "", 10);
if (!Number.isFinite(demoMax) || demoMax < 1) {
  demoMax = process.env.NODE_ENV === "production" ? 60 : 200;
}

const demoLimiter = rateLimit({
  windowMs: demoWindowMs,
  max: demoMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: false,
  handler: function (req, res) {
    res.status(429).json({
      ok: false,
      error:
        "Too many demo requests from this connection. Please wait a few minutes or contact us directly.",
    });
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: function (req, res) {
    res.status(429).json({ ok: false, error: "Too many login attempts. Try again later." });
  },
});

app.get("/api/public-config.js", (req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  const payload = {
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null,
  };
  res.send(`window.__WOBCOM__=${JSON.stringify(payload)};`);
});

app.post("/api/demo-request", demoLimiter, postDemoRequest);

app.get("/api/admin/session", getSessionStatus);
app.post("/api/admin/login", loginLimiter, postLogin);
app.post("/api/admin/logout", postLogout);
app.get("/api/admin/submissions", requireAdmin, getSubmissions);

app.use(express.static(rootDir, { index: ["index.html"] }));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  return res.status(404).send("Not found");
});

const port = parseInt(process.env.PORT || "3000", 10);

initDb()
  .then(function () {
    app.listen(port, function () {
      console.log(`Wobcom server listening on http://localhost:${port}`);
    });
  })
  .catch(function (err) {
    console.error("[db] Failed to initialize:", err);
    process.exit(1);
  });
