/**
 * Ascension — application intake (uncapped, stored in Netlify Blobs).
 * Replaces Netlify Forms so there is no monthly submission cap.
 * POST (JSON or urlencoded) the application fields + honeypot "company".
 * Stores the application, emails the guest a confirmation and alerts the team.
 */
import { stores, esc, json, siteUrl, sendEmail, fromAddress, shell, para, label, SLOGAN, INSTAGRAM } from "./lib/shared.mjs";

const FIELDS = ["first_name", "surname", "email", "phone", "instagram", "occupation", "heard_from", "invited_by", "updates_optin"];

function confirmationEmail(data, url) {
  const first = esc(data.first_name || "there");
  const inner = `
    <div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;">
      ${para(`Hi ${first},`)}
      ${para(`Thank you for registering your interest for <span style="color:#f4f1ec;">A&nbsp;Night&nbsp;With&nbsp;Ascension</span>.`, true)}
      ${para(`Your application has been received and is currently under review.`, true)}
      ${para(`As attendance is intentionally limited, each application is considered individually.`, true)}
      ${para(`If successful, you will receive a confirmation email with full event details closer to the event.`, true)}
      <p style="margin:0 0 26px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.8;color:#f4f1ec;">Until then&hellip; stay connected with us.</p>
      <p style="margin:0 0 8px;text-align:center;">
        <a href="${INSTAGRAM}" style="display:inline-block;padding:13px 34px;border:1px solid rgba(244,241,236,0.4);color:#f4f1ec;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;text-decoration:none;">Instagram&nbsp;&nbsp;@ascensionlondon</a>
      </p>
    </div>`;
  return shell(url, inner);
}

function alertEmail(data, url) {
  const rows = [
    ["Name", `${data.first_name} ${data.surname}`.trim()],
    ["Email", data.email], ["Phone", data.phone],
    ["Instagram", data.instagram ? `@${data.instagram}` : ""],
    ["Occupation", data.occupation], ["Heard from", data.heard_from],
    ["Invited by", data.invited_by], ["Updates opt-in", data.updates_optin],
  ].filter(([, v]) => v).map(([k, v]) => `<tr>
    <td style="padding:8px 18px 8px 0;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#8a8a8a;white-space:nowrap;vertical-align:top;">${k}</td>
    <td style="padding:8px 0;font-size:14px;color:#111111;">${esc(v)}</td></tr>`).join("");
  return `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#111;margin:0 0 4px;">Ascension</p>
    <p style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#8a8a8a;margin:0 0 28px;">New application received</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e2dc;border-bottom:1px solid #e5e2dc;width:100%;padding:6px 0;">${rows}</table>
    <p style="margin:26px 0 0;"><a href="${url}/admin.html" style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#111;">Open the guest list →</a></p>
  </div>`;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });

  let data = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) data = await req.json();
    else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params) data[k] = v;
    }
  } catch (_) {}

  // Honeypot — bots fill "company". Pretend success, store nothing.
  if ((data.company || "").trim()) return json(200, { ok: true });

  const clean = {};
  for (const f of FIELDS) clean[f] = String(data[f] ?? "").trim().slice(0, 300);
  if (!clean.first_name || !clean.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email)) {
    return json(422, { error: "A name and valid email are required." });
  }

  const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { id, created_at: new Date().toISOString(), ...clean };

  try {
    await stores.applications().setJSON(id, record);
  } catch (e) {
    console.error("store application failed", e);
    return json(500, { error: "Could not save your application. Please try again." });
  }

  const url = siteUrl(req);
  const from = fromAddress();
  // guest confirmation (needs a verified-domain sender)
  if (process.env.NOTIFY_FROM && clean.email) {
    await sendEmail({ from, to: [clean.email], subject: "Application Received | A Night With Ascension", html: confirmationEmail(clean, url) });
  }
  // team alert
  if (process.env.NOTIFY_EMAIL) {
    await sendEmail({ from, to: [process.env.NOTIFY_EMAIL], subject: `New Ascension application — ${clean.first_name} ${clean.surname}`.trim(), html: alertEmail(clean, url) });
  }

  return json(200, { ok: true, id });
};
