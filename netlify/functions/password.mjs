/**
 * Ascension — admin password management.
 * GET  → { enabled, can_enable, has_custom }  (public: only booleans, no guest data)
 * POST { action: "change", new_password }  → store a hashed custom password (lock ON)
 *      { action: "reset" }                  → clear the custom password (revert to ADMIN_PASSWORD env)
 *      { action: "disable" }                → switch the lock OFF (portal open to anyone with the link)
 *      { action: "enable" }                 → switch the lock back ON (using the existing password)
 * POST auth: x-admin-key must match the CURRENT password (checkAdmin). When the lock is
 * already off, checkAdmin passes, so you can re-enable it.
 */
import { checkAdmin, hashPassword, randToken, passwordState, stores, json } from "./lib/shared.mjs";

export default async (req) => {
  const store = stores.auth();

  // Public status — lets the admin page decide whether to show the lock screen.
  if (req.method === "GET") {
    return json(200, await passwordState());
  }

  if (req.method !== "POST") return json(405, { error: "GET or POST only." });

  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const action = String(body.action || "").toLowerCase();

  if (action === "reset") {
    if (!process.env.ADMIN_PASSWORD) {
      return json(422, { error: "No default password is configured, so it can't be reset. Change the password instead." });
    }
    await store.delete("pw").catch(() => {});
    return json(200, { ok: true, reset: true, ...(await passwordState()) });
  }

  if (action === "change") {
    const pw = String(body.new_password || "");
    if (pw.length < 6) return json(422, { error: "Password must be at least 6 characters." });
    if (pw.length > 200) return json(422, { error: "Password is too long." });
    const salt = randToken(16);
    const hash = await hashPassword(pw, salt);
    await store.setJSON("pw", { hash, salt, disabled: false, updated_at: new Date().toISOString() });
    return json(200, { ok: true, changed: true, ...(await passwordState()) });
  }

  if (action === "disable") {
    const cur = (await store.get("pw", { type: "json" })) || {};
    await store.setJSON("pw", { ...cur, disabled: true, updated_at: new Date().toISOString() });
    return json(200, { ok: true, disabled: true, ...(await passwordState()) });
  }

  if (action === "enable") {
    const cur = (await store.get("pw", { type: "json" })) || {};
    if (!cur.hash && !process.env.ADMIN_PASSWORD) {
      return json(422, { error: "There's no password to turn on yet — set one first with “Change password”." });
    }
    await store.setJSON("pw", { ...cur, disabled: false, updated_at: new Date().toISOString() });
    return json(200, { ok: true, enabled: true, ...(await passwordState()) });
  }

  return json(422, { error: "Unknown action." });
};
