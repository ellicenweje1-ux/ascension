/**
 * Ascension — reusable email templates for the Communications Centre.
 * GET  -> { templates: { key: {subject, body} } } (seeded with defaults)
 * POST -> save { key, subject, body }
 * Auth: x-admin-key = ADMIN_PASSWORD.
 */
import { checkAdmin, json, stores } from "./lib/shared.mjs";

export const DEFAULTS = {
  invitation: {
    name: "Invitation",
    auto: true,
    subject: "You're invited | A Night With Ascension",
    body: "Sent automatically when you accept a guest. It carries a personal Confirm Attendance button and cannot be group-sent. Edit the wording with the developer if needed.",
  },
  reminder: {
    name: "Reminder",
    subject: "A Night With Ascension — a few days to go",
    body: "Hi {first_name},\n\nA note ahead of A Night With Ascension.\n\nDate: {date}\nArrival: {arrival}\nVenue: {venue}\n\nDress code: Contemporary Elegance — elevated eveningwear.\n\nPlease arrive within your arrival window. We look forward to welcoming you.",
  },
  cancellation: {
    name: "Cancellation",
    subject: "A Night With Ascension — an update",
    body: "Hi {first_name},\n\nWe're writing to let you know about a change to A Night With Ascension.\n\n[Add your message here.]\n\nWith thanks,\nAscension",
  },
  waitlist: {
    name: "Waitlist",
    subject: "Ascension — Priority Waitlist",
    body: "Thank you for your interest in Ascension and for taking the time to submit an application.\n\nDue to the level of interest in this event, we have now reached our current guest capacity. Rather than closing your application, we have placed you on our priority waitlist.\n\nShould additional places become available, we will contact waitlisted applicants in the order that spaces become available.\n\nThank you for being part of the Ascension community.",
  },
  announcement: {
    name: "General Announcement",
    subject: "A note from Ascension",
    body: "Hi {first_name},\n\n[Your announcement here.]\n\nAscension\nMusic · Discovery · Culture",
  },
};

export default async (req) => {
  const auth = checkAdmin(req);
  if (!auth.ok) return auth.res;
  const store = stores.templates();

  if (req.method === "GET") {
    const saved = (await store.get("map", { type: "json" })) || {};
    const out = {};
    for (const key of Object.keys(DEFAULTS)) {
      out[key] = { ...DEFAULTS[key], ...(saved[key] || {}) };
    }
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
