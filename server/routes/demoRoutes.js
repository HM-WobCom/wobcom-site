"use strict";

const { body, validationResult } = require("express-validator");
const { insertDemoRequest } = require("../db");
const { sendDemoNotificationEmail } = require("../services/emailService");
const { verifyRecaptchaV3 } = require("../services/recaptcha");

const MAX_FIELD = {
  name: 200,
  email: 254,
  phone: 32,
  business: 200,
  message: 8000,
};

function normalizeWhitespace(str) {
  return String(str).replace(/\s+/g, " ").trim();
}

function sanitizeText(str, maxLen) {
  let s = String(str).trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

async function runDemoValidation(req) {
  await body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required.")
    .isLength({ max: MAX_FIELD.name })
    .withMessage("Name is too long.")
    .run(req);

  await body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required.")
    .isEmail()
    .withMessage("Enter a valid email address.")
    .normalizeEmail()
    .isLength({ max: MAX_FIELD.email })
    .run(req);

  await body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required.")
    .matches(/^[\d\s\-+().]{7,32}$/)
    .withMessage("Enter a valid phone number.")
    .run(req);

  await body("businessName")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: MAX_FIELD.business })
    .withMessage("Business name is too long.")
    .run(req);

  await body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required.")
    .isLength({ min: 10, max: MAX_FIELD.message })
    .withMessage("Message must be between 10 and 8000 characters.")
    .run(req);

  await body("company_website")
    .custom((value) => value === undefined || value === null || String(value).trim() === "")
    .withMessage("Spam detected.")
    .run(req);

  await body("recaptchaToken")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Invalid captcha token.")
    .run(req);
}

async function postDemoRequest(req, res) {
  try {
    await runDemoValidation(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed.",
        details: errors.array({ onlyFirstError: true }).map((e) => e.msg),
      });
    }

    const ip =
      (req.headers["x-forwarded-for"] && String(req.headers["x-forwarded-for"]).split(",")[0].trim()) ||
      req.socket.remoteAddress ||
      "";

    const recaptchaOk = await verifyRecaptchaV3(req.body.recaptchaToken, ip);
    if (!recaptchaOk) {
      return res.status(400).json({ ok: false, error: "Captcha verification failed. Please try again." });
    }

    const name = sanitizeText(normalizeWhitespace(req.body.name), MAX_FIELD.name);
    const email = String(req.body.email).trim().toLowerCase();
    const phone = sanitizeText(req.body.phone.replace(/\s+/g, " "), MAX_FIELD.phone);
    const businessRaw = req.body.businessName;
    const business_name =
      businessRaw && String(businessRaw).trim()
        ? sanitizeText(normalizeWhitespace(businessRaw), MAX_FIELD.business)
        : "";
    const message = sanitizeText(req.body.message, MAX_FIELD.message);

    const user_agent = req.headers["user-agent"] ? String(req.headers["user-agent"]).slice(0, 512) : "";

    const row = {
      name,
      email,
      phone,
      business_name,
      message,
      ip_address: ip.slice(0, 64),
      user_agent,
    };

    const inserted = insertDemoRequest(row);
    const created_at = inserted && inserted.created_at ? inserted.created_at : new Date().toISOString();

    try {
      await sendDemoNotificationEmail({
        ...row,
        created_at,
      });
    } catch (emailErr) {
      console.error("[email] send failed:", emailErr.message);
    }

    return res.status(201).json({
      ok: true,
      message: "Your request has been submitted successfully",
      id: inserted ? Number(inserted.id) : undefined,
    });
  } catch (err) {
    console.error("[demo-request]", err);
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again later." });
  }
}

module.exports = {
  postDemoRequest,
};
