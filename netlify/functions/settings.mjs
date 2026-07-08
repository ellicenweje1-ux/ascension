/**
 * Ascension event settings — editable from the admin portal.
 * GET  → current settings.  POST → save settings.
 * Auth: x-admin-key header = ADMIN_PASSWORD. Stored in Netlify Blobs.
 */
import { getStore } from "@netlify/blobs";

const FIELDS = [
  "event_name", "date_text", "date_iso", "doors_open", "last_entry",
  "end_time", "venue_name", "venue_address", "maps_url", "spotify_url",
];

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const supplied = req.headers.get("x-admin-key") || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password || supplied !== password) return json(401, { error: "Incorrect password." });

  const store = getStore("settings");
  if (req.method === "GET") {
    const s = (await store.get("event", { type: "json" })) || {};
    return json(200, { settings: s });
  }
  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const s = {};
    for (const f of FIELDS) s[f] = String(body[f] ?? "").slice(0, 300);
    await store.setJSON("event", s);
    return json(200, { settings: s });
  }
  return json(405, { error: "GET or POST only." });
};
