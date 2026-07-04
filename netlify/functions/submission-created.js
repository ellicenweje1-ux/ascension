/**
 * Ascension — application notification email.
 *
 * Netlify automatically runs a function named `submission-created` after
 * every verified form submission (free on all plans). This one emails a
 * summary of the application via Resend's HTTP API.
 *
 * Required environment variables (Project configuration → Environment variables):
 *   RESEND_API_KEY — API key from resend.com
 *   NOTIFY_EMAIL   — where application alerts go.
 *   NOTIFY_FROM    — optional sender, e.g. "Ascension <ascension@yourdomain.com>".
 *                    Use an address on a domain verified in the Resend account —
 *                    then NOTIFY_EMAIL can be any inbox. Defaults to Resend's
 *                    onboarding sender, which can only deliver to the Resend
 *                    account's own email address.
 *
 * If either variable is missing the function does nothing — submissions
 * are still stored in Netlify Forms and visible in /admin.html regardless.
 */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

exports.handler = async (event) => {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) {
    console.log("submission-created: RESEND_API_KEY / NOTIFY_EMAIL not set — skipping email.");
    return { statusCode: 200, body: "ok" };
  }

  let data = {};
  try {
    data = JSON.parse(event.body).payload.data || {};
  } catch (_) { /* leave empty */ }

  const name = `${data.first_name || ""} ${data.surname || ""}`.trim() || "Unknown";
  const rows = [
    ["Name", name],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Instagram", data.instagram ? `@${data.instagram}` : ""],
    ["Occupation", data.occupation],
    ["Heard from", data.heard_from],
    ["Invited by", data.invited_by],
    ["Updates opt-in", data.updates_optin],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr>
      <td style="padding:8px 18px 8px 0;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#8a8a8a;white-space:nowrap;vertical-align:top;">${k}</td>
      <td style="padding:8px 0;font-size:14px;color:#111111;">${esc(v)}</td>
    </tr>`)
    .join("");

  const siteUrl = process.env.URL || "";
  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#111111;margin:0 0 4px;">Ascension</p>
    <p style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#8a8a8a;margin:0 0 28px;">New application received</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e2dc;border-bottom:1px solid #e5e2dc;width:100%;padding:6px 0;">${rows}</table>
    ${siteUrl ? `<p style="margin:26px 0 0;"><a href="${siteUrl}/admin.html" style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#111111;">Open the guest list →</a></p>` : ""}
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || "Ascension <onboarding@resend.dev>",
      to: [to],
      subject: `New Ascension application — ${name}`,
      html,
    }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text().catch(() => ""));
  return { statusCode: 200, body: "ok" };
};
