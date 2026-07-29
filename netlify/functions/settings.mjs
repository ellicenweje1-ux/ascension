/**
 * Ascension event settings — editable from the admin portal.
 * GET  → current settings.  POST → save settings.
 * Auth: x-admin-key header = ADMIN_PASSWORD. Stored in Netlify Blobs.
 */
import { getStore } from "@netlify/blobs";
import { checkAdmin, json } from "./lib/shared.mjs";

const FIELDS = [
  "event_name", "date_text", "date_iso", "doors_open", "last_entry",
  "end_time", "venue_name", "venue_address", "maps_url", "spotify_url",
  "late_signup_cutoff", "feedback_send_after",
];

export default async (req) => {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;

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
