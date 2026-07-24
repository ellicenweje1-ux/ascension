/**
 * Ascension guest review (admin) — move a guest through the pipeline.
 * POST { id, action, guest:{first_name,surname,email} }
 *   action: "accept"   -> status "invited"  + sends the Invitation email
 *           "waitlist" -> status "waitlisted" + sends the Waitlist email
 *           "decline"  -> status "declined"  (silent)
 *           "resend"   -> re-sends the current invitation email
 *           "undo"     -> back to "pending"
 * Auth: x-admin-key = ADMIN_PASSWORD.
 */
import {
  checkAdmin, json, esc, siteUrl, sendEmail, fromAddress, randToken,
  getSettings, getStatuses, saveStatuses, shell, para, label, button, outlineButton,
} from "./lib/shared.mjs";

function invitationEmail(guest, s, url, confirmUrl, declineUrl) {
  const first = esc(guest.first_name || "there");
  const venue = [s.venue_name, s.venue_address].filter(Boolean).join(", ");
  const inner = `
    <div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;">
      ${para(`Thank you for your application to Ascension.`)}
      ${para(`We're pleased to let you know that your application has been successful and we'd like to invite you to join us for our upcoming event.`, true)}

      <div style="margin:6px 0 6px;">${label("Event details")}</div>
      ${s.date_text ? `<p style="margin:0 0 6px;font-size:14px;letter-spacing:0.04em;color:#f4f1ec;"><span style="color:rgba(244,241,236,0.5);">Date:</span> ${esc(s.date_text)}</p>` : ""}
      ${venue ? `<p style="margin:0 0 26px;font-size:14px;letter-spacing:0.04em;color:#f4f1ec;line-height:1.6;"><span style="color:rgba(244,241,236,0.5);">Venue:</span> ${esc(venue)}</p>` : ""}

      ${para(`Your attendance has now been reserved, but we ask that you confirm you are able to attend by selecting the button below.`, true)}
      <div style="text-align:center;padding:14px 0 10px;">
        ${button("Confirm Attendance", confirmUrl)}
      </div>
      <p style="margin:6px 0 30px;text-align:center;font-size:12px;letter-spacing:0.06em;color:rgba(244,241,236,0.5);">
        Unable to attend? <a href="${esc(declineUrl)}" style="color:rgba(244,241,236,0.8);">Let us know here.</a>
      </p>
      ${para(`Once your attendance has been confirmed, you'll receive your official digital invitation along with your unique ticket reference.`, true)}

      <div style="margin:14px 0 6px;">${label("Dress code")}</div>
      ${para(`The evening has been designed to reflect the atmosphere and identity of Ascension. We encourage guests to dress accordingly. Further details regarding the dress code will be available on the confirmation page.`, true)}

      <div style="margin:14px 0 6px;">${label("Arrival")}</div>
      ${para(`Please arrive within your allocated arrival window. This helps us provide the best possible experience for every guest and ensures a smooth arrival throughout the evening.`, true)}

      <div style="margin:14px 0 6px;">${label("Photography &amp; content")}</div>
      ${para(`Photography and video will be taking place throughout the evening. By attending, you acknowledge that imagery captured during the event may be used across Ascension's marketing and social media channels.`, true)}

      <div style="margin:14px 0 6px;">${label("Guest information")}</div>
      ${para(`Each invitation is issued individually following a review of every application. Admission is reserved exclusively for the named guest and invitations cannot be transferred or shared.`, true)}
      ${para(`If your plans change and you're unable to attend, please let us know as soon as possible so that we can offer your place to another applicant.`, true)}
      <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.8;color:#f4f1ec;">We look forward to welcoming you to A Night With Ascension.</p>
    </div>`;
  return shell(url, inner);
}

function waitlistEmail(guest, url) {
  const first = esc(guest.first_name || "there");
  const inner = `
    <div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;">
      ${para(`Hi ${first},`)}
      ${para(`Thank you for your interest in Ascension and for taking the time to submit an application.`, true)}
      ${para(`Due to the level of interest in this event, we have now reached our current guest capacity.`, true)}
      ${para(`Rather than closing your application, we have placed you on our priority waitlist.`, true)}
      ${para(`Should additional places become available, or if confirmed guests are no longer able to attend, we will contact waitlisted applicants in the order that spaces become available.`, true)}
      ${para(`Your application will also remain active for future Ascension events, where priority consideration may be given to guests who have previously registered their interest.`, true)}
      ${para(`We genuinely appreciate your support and the enthusiasm shown for Ascension. We hope to welcome you to an event very soon, and we'll be in touch immediately if a place becomes available.`, true)}
      <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.8;color:#f4f1ec;">Thank you for being part of the Ascension community.</p>
    </div>`;
  return shell(url, inner);
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const auth = checkAdmin(req);
  if (!auth.ok) return auth.res;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const id = String(body.id || "");
  const action = String(body.action || "");
  const guest = body.guest || {};
  if (!id || !["accept", "waitlist", "decline", "resend", "undo"].includes(action)) {
    return json(422, { error: "Missing id or invalid action." });
  }

  const map = await getStatuses();
  const entry = map[id] || {};
  const url = siteUrl(req);
  const from = fromAddress();
  const settings = await getSettings();
  let emailed = false;
  let note = "";

  const sendInvite = async () => {
    if (!process.env.NOTIFY_FROM || !guest.email) {
      note = "Saved — invitation email skipped (email not configured or no guest email).";
      return;
    }
    if (!entry.token) entry.token = randToken();
    const link = `${url}/confirm.html?id=${encodeURIComponent(id)}&t=${entry.token}`;
    const r = await sendEmail({
      from, to: [guest.email], subject: "You're invited | A Night With Ascension",
      html: invitationEmail(guest, settings, url, link, link + "&d=1"),
    });
    emailed = r.ok;
    if (!r.ok) note = "Saved, but the invitation email failed to send.";
  };

  if (action === "accept" || action === "resend") {
    entry.status = "invited";
    entry.guest = { first_name: guest.first_name || "", surname: guest.surname || "", email: guest.email || "" };
    entry.invited_at = entry.invited_at || new Date().toISOString();
    if (action === "resend") entry.invited_at = new Date().toISOString();
    await sendInvite();
  } else if (action === "waitlist") {
    entry.status = "waitlisted";
    entry.guest = { first_name: guest.first_name || "", surname: guest.surname || "", email: guest.email || "" };
    entry.waitlisted_at = new Date().toISOString();
    if (process.env.NOTIFY_FROM && guest.email) {
      const r = await sendEmail({ from, to: [guest.email], subject: "Ascension — Priority Waitlist", html: waitlistEmail(guest, url) });
      emailed = r.ok;
      if (!r.ok) note = "Saved, but the waitlist email failed to send.";
    } else {
      note = "Saved — waitlist email skipped (email not configured or no guest email).";
    }
  } else if (action === "decline") {
    entry.status = "declined";
    entry.declined_at = new Date().toISOString();
    entry.declined_by = "admin";
  } else if (action === "undo") {
    delete map[id];
    await saveStatuses(map);
    return json(200, { id, status: "pending", entry: null });
  }

  map[id] = entry;
  await saveStatuses(map);
  return json(200, { id, status: entry.status, entry, emailed, note });
};
