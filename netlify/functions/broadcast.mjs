/**
 * Ascension — Communications Centre send + preview.
 * POST { key, group, test_to?, preview? }  (auth: x-admin-key = ADMIN_PASSWORD)
 *   preview:true -> returns { html } rendered with sample data (no send)
 *   test_to      -> sends a single preview email to that address
 *   group        -> all | pending | invited | confirmed | issued | waitlisted | declined | optin
 * Personalises {first_name}, {event}, {date}, {arrival}, {venue}. The
 * invitation template can be previewed/tested but not group-sent (it needs a
 * per-guest Confirm link, which the Accept action handles).
 */
import {
  checkAdmin, json, siteUrl, fromAddress, getSettings, getStatuses, getStatus, saveStatus,
  listApplications, loadTemplate, DEFAULTS, proseEmail, invitationEmailHtml, buttonEmail,
  eventVars, stores, randToken,
} from "./lib/shared.mjs";

async function sendBatches(from, messages) {
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)" },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
    else console.error("batch send failed", res.status, await res.text().catch(() => ""));
  }
  return sent;
}

function renderFor(key, url, body, vars, confirmUrl, declineUrl) {
  if (key === "invitation") return invitationEmailHtml(url, body, vars, confirmUrl || "#", declineUrl || "#");
  if (key === "feedback") return buttonEmail(url, body, vars, "Share your feedback", confirmUrl || "#");
  return proseEmail(url, body, vars);
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const key = String(body.key || "");
  if (!DEFAULTS[key]) return json(422, { error: "Unknown template." });

  const settings = await getSettings();
  const url = siteUrl(req);
  const from = fromAddress();
  const evars = eventVars(settings);
  const tpl = await loadTemplate(key);
  // preview + test may pass live (unsaved) edits; group send always uses the saved template
  const subjOverride = (typeof body.subject === "string" && body.subject.trim()) ? body.subject : null;
  const bodyOverride = (typeof body.body === "string" && body.body.trim()) ? body.body : null;
  const subject = subjOverride || tpl.subject;
  const rawBody = bodyOverride || tpl.body;

  // preview (no send) — sample data + dummy links
  if (body.preview) {
    const html = renderFor(key, url, rawBody, { first_name: "there", ...evars },
      `${url}/confirm.html?id=SAMPLE&t=SAMPLE`, `${url}/confirm.html?id=SAMPLE&t=SAMPLE&d=1`);
    return json(200, { html, subject });
  }

  if (!process.env.NOTIFY_FROM) return json(400, { error: "Email is not configured (NOTIFY_FROM)." });

  // test send
  const testTo = String(body.test_to || "").trim();
  if (testTo) {
    const html = renderFor(key, url, rawBody, { first_name: "there", ...evars },
      `${url}/confirm.html?id=SAMPLE&t=SAMPLE`, `${url}/confirm.html?id=SAMPLE&t=SAMPLE&d=1`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)" },
      body: JSON.stringify({ from, to: [testTo], subject, html }),
    });
    return json(res.ok ? 200 : 502, res.ok ? { ok: true, test: true } : { error: `Test send failed (${res.status}).` });
  }

  // invitation is per-guest only (sent via the Accept button)
  if (key === "invitation") {
    return json(422, { error: "The invitation is sent per guest via the Accept button — it can't be group-sent." });
  }

  // Feedback — personal link per guest, to everyone we CHECKED IN on the day.
  if (key === "feedback") {
    const apps = await listApplications();
    const checkins = (await stores.checkins().get("map", { type: "json" })) || {};
    const recipients = apps.filter((a) => a.email && checkins[a.id]);
    if (!recipients.length) return json(200, { ok: true, sent: 0, note: "No checked-in guests yet." });
    const messages = [];
    for (const a of recipients) {
      let st = (await getStatus(a.id)) || {};
      if (!st.token) { st = { ...st, token: randToken() }; await saveStatus(a.id, st); }
      const link = `${url}/feedback.html?id=${encodeURIComponent(a.id)}&t=${st.token}`;
      messages.push({ from, to: [a.email], subject, html: buttonEmail(url, rawBody, { first_name: a.first_name || "there", ...evars }, "Share your feedback", link) });
    }
    const sent = await sendBatches(from, messages);
    return json(200, { ok: true, sent, total: recipients.length });
  }

  const group = String(body.group || "");
  const cutoff = Date.parse(settings.late_signup_cutoff || "");
  const apps = await listApplications();
  const statuses = await getStatuses();
  const recipients = apps.filter((a) => {
    if (!a.email) return false;
    const st = (statuses[a.id] && statuses[a.id].status) || "pending";
    if (group === "late") return !isNaN(cutoff) && Date.parse(a.created_at || "") >= cutoff;
    if (group === "all") return true;
    if (group === "optin") return (a.updates_optin || "").toLowerCase() === "yes";
    return st === group;
  });
  if (group === "late" && isNaN(cutoff)) return json(422, { error: "Set the sign-up cutoff date & time first." });
  if (!recipients.length) return json(200, { ok: true, sent: 0, note: "No matching recipients." });

  const messages = recipients.map((a) => ({
    from, to: [a.email], subject,
    html: renderFor(key, url, rawBody, { first_name: a.first_name || "there", ...evars }),
  }));
  const sent = await sendBatches(from, messages);
  return json(200, { ok: true, sent, total: recipients.length });
};
