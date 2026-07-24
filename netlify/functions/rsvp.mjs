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
  json, esc, siteUrl, sendEmail, fromAddress, nextTicketRef,
  getSettings, getStatuses, saveStatuses, shell,
} from "./lib/shared.mjs";

function arrivalText(s) {
  return [s.doors_open && `Doors open ${s.doors_open}`, s.last_entry && `Last entry ${s.last_entry}`].filter(Boolean).join("  ·  ");
}

function invitationPayload(entry, settings) {
  const g = entry.guest || {};
  return {
    guest_name: `${g.first_name || ""} ${g.surname || ""}`.trim(),
    event_name: settings.event_name || "A Night With Ascension",
    date_text: settings.date_text || "",
    venue_name: settings.venue_name || "",
    venue_address: settings.venue_address || "",
    arrival: arrivalText(settings),
    ticket_ref: entry.ticket_ref || "",
    dress_code: "Contemporary Elegance",
  };
}

function invitationEmail(inv, url) {
  const line = (labelTxt, val) => val ? `<tr>
    <td style="padding:8px 0;font-size:9.5px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(244,241,236,0.4);width:120px;vertical-align:top;">${labelTxt}</td>
    <td style="padding:8px 0;font-size:14px;letter-spacing:0.05em;color:#f4f1ec;line-height:1.55;">${esc(val)}</td></tr>` : "";
  const inner = `
    <div style="border:1px solid rgba(244,241,236,0.22);padding:44px 34px;text-align:center;">
      <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.5em;text-transform:uppercase;color:rgba(244,241,236,0.45);">You are invited to</p>
      <p style="margin:0 0 30px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:26px;line-height:1.3;color:#f4f1ec;">${esc(inv.event_name)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;text-align:left;border-top:1px solid rgba(244,241,236,0.14);border-bottom:1px solid rgba(244,241,236,0.14);margin:0 0 26px;">
        ${line("Guest", inv.guest_name)}
        ${line("Date", inv.date_text)}
        ${line("Venue", [inv.venue_name, inv.venue_address].filter(Boolean).join(", "))}
        ${line("Arrival", inv.arrival)}
        ${line("Dress", inv.dress_code)}
      </table>
      <p style="margin:0 0 6px;font-size:9.5px;letter-spacing:0.34em;text-transform:uppercase;color:rgba(244,241,236,0.4);">Ticket reference</p>
      <p style="margin:0 0 26px;font-family:'Courier New',monospace;font-size:18px;letter-spacing:0.28em;color:#f4f1ec;">${esc(inv.ticket_ref)}</p>
      <p style="margin:0;font-size:12px;line-height:1.8;letter-spacing:0.05em;color:rgba(244,241,236,0.5);">Admission is by guest list verification.<br>This invitation is personal to you and non-transferable.</p>
    </div>
    <p style="margin:28px 0 0;text-align:center;font-size:13px;line-height:1.9;color:rgba(244,241,236,0.6);">We look forward to welcoming you to <span style="color:#f4f1ec;">${esc(inv.event_name)}</span>.</p>`;
  return shell(url, inner);
}

async function issueInvitation(entry, settings, url) {
  // idempotent: only mint once
  if (!entry.ticket_ref) {
    entry.ticket_ref = await nextTicketRef(settings);
    entry.issued_at = new Date().toISOString();
  }
  entry.status = "issued";
  const inv = invitationPayload(entry, settings);
  if (process.env.NOTIFY_FROM && entry.guest && entry.guest.email && !entry.invitation_sent) {
    const r = await sendEmail({
      from: fromAddress(), to: [entry.guest.email],
      subject: `Your Invitation | ${inv.event_name} — ${inv.ticket_ref}`,
      html: invitationEmail(inv, url),
    });
    if (r.ok) entry.invitation_sent = true;
  }
  return inv;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const id = String(body.id || "");
  const t = String(body.t || "");
  const action = String(body.action || "view");
  if (!id || !t) return json(400, { error: "This link is missing information." });

  const map = await getStatuses();
  const entry = map[id];
  if (!entry || !entry.token || entry.token !== t) {
    return json(403, { error: "This link is invalid or has expired." });
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
        arrival: arrivalText(settings),
      },
      invitation: (entry.status === "issued") ? invitationPayload(entry, settings) : null,
    });
  }

  if (action === "confirm") {
    if (entry.status === "declined") return json(409, { error: "This place was declined. Please contact us if this is a mistake." });
    if (!entry.confirmed_at) entry.confirmed_at = new Date().toISOString();
    const inv = await issueInvitation(entry, settings, siteUrl(req));
    map[id] = entry;
    await saveStatuses(map);
    return json(200, { status: entry.status, invitation: inv });
  }

  if (action === "decline") {
    if (entry.status !== "issued") {
      entry.status = "declined";
      entry.declined_at = new Date().toISOString();
      entry.declined_by = "guest";
      map[id] = entry;
      await saveStatuses(map);
    }
    return json(200, { status: entry.status });
  }

  return json(422, { error: "Unknown action." });
};
