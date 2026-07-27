/**
 * Ascension door check-in — records who actually attended.
 * POST { id, checked_in: true|false }  (auth: x-admin-key = ADMIN_PASSWORD)
 * State lives in Netlify Blobs (store "checkins", key "map"):
 *   { [submissionId]: { at: ISO timestamp } }
 */
import { getStore } from "@netlify/blobs";
import { checkAdmin, json } from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;

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
