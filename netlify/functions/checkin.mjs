/**
 * Ascension door check-in — records who actually attended.
 * POST { id, checked_in: true|false }  (auth: x-admin-key = ADMIN_PASSWORD)
 * State lives in Netlify Blobs (store "checkins", key "map"):
 *   { [submissionId]: { at: ISO timestamp } }
 */
import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const supplied = req.headers.get("x-admin-key") || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password || supplied !== password) return json(401, { error: "Incorrect password." });

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const id = String(body.id || "");
  if (!id) return json(422, { error: "Missing id." });

  const store = getStore("checkins");
  const map = (await store.get("map", { type: "json" })) || {};
  let at = "";
  if (body.checked_in) {
    at = new Date().toISOString();
    map[id] = { at };
  } else {
    delete map[id];
  }
  await store.setJSON("map", map);
  return json(200, { id, checked_in_at: at });
};
