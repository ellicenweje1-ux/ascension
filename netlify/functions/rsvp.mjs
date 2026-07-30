/**
 * Ascension — guest RSVP (public, token-protected).
 * POST { id, t, action }
 *   action "view"    -> returns guest name, event details, current status
 *   action "confirm" -> records confirmation, mints ticket ref, emails the
 *                       digital invitation, returns the invitation payload
 *   action "decline" -> records a decline
 * The token (t) must match the one stored when the invitation was sent.
 */
import {
  json, siteUrl, getSettings, getStatus, saveStatus,
  ticketArrival, ticketPayload, issueTicket,
} from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const id = String(body.id || "");
  const t = String(body.t || "");
  const action = String(body.action || "view");
  if (!id || !t) return json(400, { error: "This link is missing information." });

  const entry = await getStatus(id);
  if (!entry || !entry.token || entry.token !== t) {
    return json(403, { error: "We couldn't open this invitation. If you've received more than one email from us, please open the most recent one — or reply to it and we'll help." });
  }

  const settings = await getSettings();
  const g = entry.guest || {};

  if (action === "view") {
    return json(200, {
      status: entry.status,
      guest_name: `${g.first_name || ""} ${g.surname || ""}`.trim(),
      first_name: g.first_name || "",
      event: {
        event_name: settings.event_name || "A Night With Ascension",
        date_text: settings.date_text || "",
        venue_name: settings.venue_name || "",
        venue_address: settings.venue_address || "",
        arrival: ticketArrival(settings),
      },
      invitation: (entry.status === "issued") ? ticketPayload(entry, settings) : null,
    });
  }

  if (action === "confirm") {
    if (entry.status === "declined") return json(409, { error: "This place was declined. Please contact us if this is a mistake." });
    if (!entry.confirmed_at) entry.confirmed_at = new Date().toISOString();
    const { inv } = await issueTicket(entry, settings, siteUrl(req)); // idempotent: won't re-send if already emailed
    await saveStatus(id, entry);
    return json(200, { status: entry.status, invitation: inv });
  }

  if (action === "decline") {
    if (entry.status !== "issued") {
      entry.status = "declined";
      entry.declined_at = new Date().toISOString();
      entry.declined_by = "guest";
      await saveStatus(id, entry);
    }
    return json(200, { status: entry.status });
  }

  return json(422, { error: "Unknown action." });
};
