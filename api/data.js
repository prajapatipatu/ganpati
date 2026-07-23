// /api/data.js
// Proxies all Google Apps Script calls. The real Apps Script
// URL lives only in the APPS_SCRIPT_URL environment variable
// on Vercel, so it's never visible in the browser or in
// script.js. Write actions (add/update/delete/uploadImage)
// require a valid token that /api/login.js issued.

import crypto from "crypto";

function isValidToken(token) {
  if (!token) return false;
  const [expiry, sig] = String(token).split(".");
  if (!expiry || !sig) return false;
  if (Date.now() > Number(expiry)) return false;

  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(expiry)
    .digest("hex");

  return expected === sig;
}

export default async function handler(req, res) {
  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

  if (req.method === "GET") {
    const { sheet, year } = req.query;
    const url = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheet)}&year=${encodeURIComponent(year || "all")}`;
    const r = await fetch(url);
    const json = await r.json();
    return res.status(200).json(json);
  }

  if (req.method === "POST") {
    const { sheet, action, data } = req.body || {};

    const writeActions = ["add", "update", "delete", "uploadImage"];
    if (writeActions.includes(action)) {
      const token = req.headers["x-auth-token"];
      if (!isValidToken(token)) {
        return res.status(401).json({ error: "Not authorized." });
      }
    }

    const r = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ sheet, action, data })
    });
    const json = await r.json();
    return res.status(200).json(json);
  }

  return res.status(405).json({ error: "Method not allowed" });
}