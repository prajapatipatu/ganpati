// /api/login.js
// Runs on Vercel's server, NOT in the browser. Reads admin
// credentials from environment variables, so they never
// appear in any file the browser downloads.

import crypto from "crypto";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body || {};

  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
    return res.status(401).json({ error: "Username and password is wrong." });
  }

  // Build a simple signed token: expiry timestamp + HMAC signature.
  // No password or username is ever placed inside the token.
  const expiry = Date.now() + 1000 * 60 * 60 * 6; // valid for 6 hours
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(String(expiry))
    .digest("hex");

  const token = `${expiry}.${sig}`;
  return res.status(200).json({ token });
}