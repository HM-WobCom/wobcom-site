"use strict";

const nodemailer = require("nodemailer");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * @param {object} row — sanitized submission fields + created_at label
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function sendDemoNotificationEmail(row) {
  const to = process.env.EMAIL_TO;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  if (!to || !from) {
    console.warn("[email] EMAIL_TO or EMAIL_FROM not set; skipping send.");
    return { ok: false, skipped: true, error: "Email not configured" };
  }

  const transport = buildTransporter();
  if (!transport) {
    console.warn("[email] SMTP_HOST not set; skipping send.");
    return { ok: false, skipped: true, error: "SMTP not configured" };
  }

  const subject = `[Wobcom] New demo request from ${row.name}`;

  const text = [
    "New Request a Demo submission",
    "===========================",
    `Name: ${row.name}`,
    `Email: ${row.email}`,
    `Phone: ${row.phone}`,
    `Business name: ${row.business_name || "(not provided)"}`,
    "",
    "Message:",
    row.message,
    "",
    `Submitted (UTC): ${row.created_at}`,
    row.ip_address ? `IP: ${row.ip_address}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a2332;">
  <h2 style="color:#0c2340;">New demo request</h2>
  <table style="border-collapse:collapse;max-width:560px;">
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Name</td><td>${escapeHtml(row.name)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Email</td><td><a href="mailto:${escapeHtml(row.email)}">${escapeHtml(row.email)}</a></td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Phone</td><td>${escapeHtml(row.phone)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Business</td><td>${escapeHtml(row.business_name || "—")}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${escapeHtml(row.message)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Submitted (UTC)</td><td>${escapeHtml(row.created_at)}</td></tr>
    ${row.ip_address ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;">IP</td><td>${escapeHtml(row.ip_address)}</td></tr>` : ""}
  </table>
</body>
</html>`;

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { ok: true };
}

module.exports = {
  sendDemoNotificationEmail,
};
