/**
 * Ascension — admin password management.
 * POST { action: "change", new_password }  → store a hashed custom password in Blobs
 *      { action: "reset" }                  → clear the custom password (fall back to ADMIN_PASSWORD env)
 * Auth: x-admin-key must match the CURRENT password (checkAdmin).
 * A password is always required — guest data stays protected. "Reset" reverts to the
 * env-var default rather than removing protection entirely.
 */
import { checkAdmin, hashPassword, randToken, stores, json } from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const action = String(body.action || "").toLowerCase();
  const store = stores.auth();

  if (action === "reset") {
    // Revert to the ADMIN_PASSWORD env var by removing the custom password.
    if (!process.env.ADMIN_PASSWORD) {
      return json(422, { error: "No default password is configured, so it can't be reset. Change the password instead." });
    }
    await store.delete("pw").catch(() => {});
    return json(200, { ok: true, reset: true });
  }

  if (action === "change") {
    const pw = String(body.new_password || "");
    if (pw.length < 6) return json(422, { error: "Password must be at least 6 characters." });
    if (pw.length > 200) return json(422, { error: "Password is too long." });
    const salt = randToken(16);
    const hash = await hashPassword(pw, salt);
    await store.setJSON("pw", { hash, salt, updated_at: new Date().toISOString() });
    return json(200, { ok: true, changed: true });
  }

  return json(422, { error: "Unknown action." });
};
