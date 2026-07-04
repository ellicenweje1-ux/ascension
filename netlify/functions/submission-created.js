/**
 * Ascension — runs automatically after every form submission (free on all plans).
 * Sends two emails via Resend's HTTP API:
 *   1. An alert to the team (NOTIFY_EMAIL).
 *   2. The "Application Received" confirmation to the guest — only when
 *      NOTIFY_FROM is set to an address on a Resend-verified domain.
 *
 * Env vars (Project configuration → Environment variables):
 *   RESEND_API_KEY — API key from resend.com
 *   NOTIFY_EMAIL   — where team alerts go.
 *   NOTIFY_FROM    — sender, e.g. "Ascension <applications@ascensionldn.co.uk>".
 *                    Must be on a domain verified in the Resend account for
 *                    guest emails to send. Defaults to Resend's onboarding
 *                    sender (team alert only, to the Resend account email).
 *
 * Missing vars = that email is skipped. Submissions are stored in Netlify
 * Forms and visible in /admin.html regardless.
 */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const IG_URL = "https://instagram.com/ascensionlondon";
const SLOGAN = "Music&nbsp;&nbsp;-&nbsp;&nbsp;Discovery&nbsp;&nbsp;-&nbsp;&nbsp;Culture";

async function sendEmail(key, msg) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)",
    },
    body: JSON.stringify(msg),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text().catch(() => ""));
  return res.ok;
}

function guestEmail(data, siteUrl) {
  const first = esc(data.first_name || "there");
  return `
<div style="background-color:#060606;padding:52px 20px 60px;">
  <div style="max-width:520px;margin:0 auto;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <div style="text-align:center;padding-bottom:40px;">
      <img src="${siteUrl}/assets/wordmark-light.png" width="230" alt="ASCENSION" style="display:inline-block;width:230px;max-width:72%;height:auto;border:0;">
    </div>
    <div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:38px;">
      <p style="margin:0 0 24px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:#f4f1ec;">Hi ${first},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.72);">Thank you for registering your interest for <span style="color:#f4f1ec;">A&nbsp;Night&nbsp;With&nbsp;Ascension</span>.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.72);">Your application has been received and is currently under review.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.72);">As attendance is intentionally limited, each application is considered individually.</p>
      <p style="margin:0 0 32px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.72);">If successful, you will receive a confirmation email with full event details closer to the event.</p>
      <p style="margin:0 0 26px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.8;color:#f4f1ec;">Until then&hellip; stay connected with us.</p>
      <p style="margin:0 0 44px;text-align:center;">
        <a href="${IG_URL}" style="display:inline-block;padding:13px 34px;border:1px solid rgba(244,241,236,0.4);color:#f4f1ec;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;text-decoration:none;">Instagram&nbsp;&nbsp;@ascensionlondon</a>
      </p>
      <p style="margin:0 0 10px;font-size:14px;letter-spacing:0.5em;text-transform:uppercase;text-align:center;color:#f4f1ec;">Ascension</p>
      <p style="margin:0 0 46px;font-size:10px;letter-spacing:0.34em;text-transform:uppercase;line-height:2.2;text-align:center;color:rgba(244,241,236,0.45);">${SLOGAN}</p>
      <p style="margin:0;font-size:11px;line-height:1.8;letter-spacing:0.04em;text-align:center;color:rgba(244,241,236,0.32);">This email was sent because you registered your interest for an Ascension event.</p>
    </div>
  </div>
</div>`;
}

exports.handler = async (event) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("submission-created: RESEND_API_KEY not set — skipping emails.");
    return { statusCode: 200, body: "ok" };
  }

  let data = {};
  try {
    data = JSON.parse(event.body).payload.data || {};
  } catch (_) { /* leave empty */ }

  const from = process.env.NOTIFY_FROM || "Ascension <onboarding@resend.dev>";
  const siteUrl = process.env.URL || "https://ascensionldn.co.uk";
  const name = `${data.first_name || ""} ${data.surname || ""}`.trim() || "Unknown";

  // 1) team alert
  const to = process.env.NOTIFY_EMAIL;
  if (to) {
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
    await sendEmail(key, {
      from,
      to: [to],
      subject: `New Ascension application — ${name}`,
      html: `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:12px;letter-spacing:0.4em;text-transform:uppercase;color:#111111;margin:0 0 4px;">Ascension</p>
    <p style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#8a8a8a;margin:0 0 28px;">New application received</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e2dc;border-bottom:1px solid #e5e2dc;width:100%;padding:6px 0;">${rows}</table>
    <p style="margin:26px 0 0;"><a href="${siteUrl}/admin.html" style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#111111;">Open the guest list →</a></p>
  </div>`,
    });
  }

  // 2) guest confirmation — needs a verified-domain sender and a guest email
  if (process.env.NOTIFY_FROM && data.email) {
    await sendEmail(key, {
      from,
      to: [data.email],
      subject: "Application Received | A Night With Ascension",
      html: guestEmail(data, siteUrl),
    });
  }

  return { statusCode: 200, body: "ok" };
};
