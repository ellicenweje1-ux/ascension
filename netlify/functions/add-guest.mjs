/**
 * Ascension — manually add a guest to the list (admin).
 * For guests who don't apply online (no social media, added by hand).
 * POST { first_name, surname?, email?, phone?, instagram?, occupation?,
 *        heard_from?, invited_by?, updates_optin?, status? }
 * Creates an application record (same shape as the public form) and, if a
 * status other than "pending" is chosen, a matching pipeline entry — so the
 * guest can appear already Confirmed/Ticketed for the door. No emails are sent
 * (manual adds are handled by hand). Auth: x-admin-key = the admin password.
 */
import {
  checkAdmin, json, stores, randToken, getSettings, nextTicketRef, saveStatus,
} from "./lib/shared.mjs";

const FIELDS = ["first_name", "surname", "email", "phone", "instagram", "occupation", "heard_from", "invited_by", "updates_optin"];
const STATUSES = ["pending", "invited", "confirmed", "issued"];

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;

  let data = {};
  try { data = await req.json(); } catch (_) {}

  const clean = {};
  for (const f of FIELDS) clean[f] = String(data[f] ?? "").trim().slice(0, 300);
  clean.instagram = clean.instagram.replace(/^@+/, ""); // store handle without @
  if (!clean.first_name) return json(422, { error: "A first name is required." });
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email)) {
    return json(422, { error: "That email address doesn't look right." });
  }
  const status = STATUSES.includes(data.status) ? data.status : "pending";

  const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { id, created_at: new Date().toISOString(), added_by: "admin", ...clean };
  try {
    await stores.applications().setJSON(id, record);
  } catch (e) {
    console.error("manual add failed", e);
    return json(500, { error: "Could not add the guest. Please try again." });
  }

  // Optional: place them straight into the pipeline (no email sent).
  if (status !== "pending") {
    const now = new Date().toISOString();
    const entry = {
      status,
      guest: { first_name: clean.first_name, surname: clean.surname, email: clean.email },
      token: randToken(),
      added_by: "admin",
    };
    if (status === "invited") entry.invited_at = now;
    if (status === "confirmed") entry.confirmed_at = now;
    if (status === "issued") {
      entry.confirmed_at = now;
      entry.issued_at = now;
      entry.ticket_ref = await nextTicketRef(await getSettings());
    }
    await saveStatus(id, entry);
  }

  return json(200, { ok: true, id, status });
};
