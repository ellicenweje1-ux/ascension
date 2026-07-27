/**
 * Ascension — reusable email templates for the Communications Centre.
 * GET  -> { templates: { key: {name, subject, body, tokened?} } } (defaults + saved)
 * POST -> save { key, subject, body }
 * Auth: x-admin-key = ADMIN_PASSWORD.
 */
import { checkAdmin, json, stores, DEFAULTS } from "./lib/shared.mjs";

export default async (req) => {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;
  const store = stores.templates();

  if (req.method === "GET") {
    const saved = (await store.get("map", { type: "json" })) || {};
    const out = {};
    for (const key of Object.keys(DEFAULTS)) out[key] = { ...DEFAULTS[key], ...(saved[key] || {}) };
    return json(200, { templates: out });
  }

  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const key = String(body.key || "");
    if (!DEFAULTS[key]) return json(422, { error: "Unknown template." });
    const saved = (await store.get("map", { type: "json" })) || {};
    saved[key] = { subject: String(body.subject || "").slice(0, 200), body: String(body.body || "").slice(0, 4000) };
    await store.setJSON("map", saved);
    return json(200, { ok: true });
  }

  return json(405, { error: "GET or POST only." });
};
