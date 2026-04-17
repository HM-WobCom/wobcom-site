"use strict";

/**
 * Verify Google reCAPTCHA v3 token (optional).
 * @returns {Promise<boolean>}
 */
async function verifyRecaptchaV3(token, remoteip) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;

  if (!token || typeof token !== "string") {
    return false;
  }

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  if (remoteip) params.set("remoteip", remoteip);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) return false;
  const data = await res.json();
  if (!data.success) return false;

  const minScore = parseFloat(String(process.env.RECAPTCHA_MIN_SCORE || "0.5"));
  if (typeof data.score === "number" && data.score < minScore) {
    return false;
  }

  return true;
}

module.exports = { verifyRecaptchaV3 };
