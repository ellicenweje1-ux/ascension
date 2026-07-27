/**
 * Ascension guest review (admin) — move a guest through the pipeline.
 * POST { id, action, guest:{first_name,surname,email} }
 *   action: "accept"   -> status "invited"  + sends the Invitation email
 *           "waitlist" -> status "waitlisted" + sends the Waitlist email
 *           "decline"  -> status "declined"  (silent)
 *           "resend"   -> re-sends the current invitation email
 *           "undo"     -> back to "pending"
 * The Invitation and Waitlist emails are the editable templates from the
 * Communications Centre (rendered here with the guest + event details).
 * Auth: x-admin-key = ADMIN_PASSWORD.
 */
import {
  checkAdmin, json, siteUrl, sendEmail, fromAddress, randToken,
  getSettings, getStatuses, saveStatuses, loadTemplate, invitationEmailHtml,
  proseEmail, eventVars,
} from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const auth = await checkAdmin(req);
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
  const evars = eventVars(settings);
  let emailed = false;
  let note = "";

  const sendInvite = async () => {
    if (!process.env.NOTIFY_FROM || !guest.email) {
      note = "Saved — invitation email skipped (email not configured or no guest email).";
      return;
    }
    if (!entry.token) entry.token = randToken();
    const link = `${url}/confirm.html?id=${encodeURIComponent(id)}&t=${entry.token}`;
    const tpl = await loadTemplate("invitation");
    const html = invitationEmailHtml(url, tpl.body, { first_name: guest.first_name || "there", ...evars }, link, link + "&d=1");
    const r = await sendEmail({ from, to: [guest.email], subject: tpl.subject, html });
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
      const tpl = await loadTemplate("waitlist");
      const html = proseEmail(url, tpl.body, { first_name: guest.first_name || "there", ...evars });
      const r = await sendEmail({ from, to: [guest.email], subject: tpl.subject, html });
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
