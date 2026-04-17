"use strict";

const crypto = require("crypto");
const { listDemoRequests } = require("../db");

function verifyAdminPassword(input) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || typeof input !== "string") return false;
  const h1 = crypto.createHash("sha256").update(secret, "utf8").digest();
  const h2 = crypto.createHash("sha256").update(input, "utf8").digest();
  return crypto.timingSafeEqual(h1, h2);
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) {
    return next();
  }
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

function postLogin(req, res) {
  const password = req.body && req.body.password;
  if (!process.env.ADMIN_PASSWORD) {
    console.error("[admin] ADMIN_PASSWORD is not set");
    return res.status(503).json({ ok: false, error: "Admin login is not configured." });
  }
  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ ok: false, error: "Invalid credentials." });
  }
  req.session.admin = true;
  req.session.touch();
  return res.json({ ok: true });
}

function postLogout(req, res) {
  req.session.destroy(function () {
    res.clearCookie("wobcom.sid", { path: "/" });
    res.json({ ok: true });
  });
}

function getSubmissions(req, res) {
  try {
    const rows = listDemoRequests(500);
    return res.json({ ok: true, submissions: rows });
  } catch (err) {
    console.error("[admin] list", err);
    return res.status(500).json({ ok: false, error: "Failed to load submissions." });
  }
}

function getSessionStatus(req, res) {
  return res.json({ ok: true, authenticated: !!(req.session && req.session.admin) });
}

module.exports = {
  requireAdmin,
  postLogin,
  postLogout,
  getSubmissions,
  getSessionStatus,
};
