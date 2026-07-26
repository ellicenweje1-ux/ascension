/**
 * Ascension — self-check. Open /.netlify/functions/health in a browser.
 * Reports whether storage works, how many applications are stored, and which
 * email settings are present. Add ?email=you@example.com to also fire a test
 * email through Resend and see the result. Reveals no secrets or guest data.
 */
import { stores } from "./lib/shared.mjs";
import { confirmationEmail } from "./register.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const testEmail = url.searchParams.get("email");
  const out = { time: new Date().toISOString() };

  // 1) storage (Netlify Blobs) write + read
  try {
    const s = stores.flags();
    const stamp = "ok-" + Date.now();
    await s.set("healthcheck", stamp);
    const back = await s.get("healthcheck", { type: "text" });
    out.storage = back === stamp ? "WORKING" : "FAILED (read mismatch)";
  } catch (e) {
    out.storage = "FAILED: " + (e && e.message ? e.message : String(e));
  }

  // 2) how many applications are stored
  try {
    const { blobs } = await stores.applications().list();
    out.applications_stored = blobs.length;
  } catch (e) {
    out.applications_stored = "could not read: " + (e && e.message ? e.message : String(e));
  }

  // 3) which settings are present (booleans only — never the values)
  out.settings = {
    admin_password_set: !!process.env.ADMIN_PASSWORD,
    resend_api_key_set: !!process.env.RESEND_API_KEY,
    email_sender_set: process.env.NOTIFY_FROM || "(missing — guest emails will NOT send)",
    team_alert_address_set: !!process.env.NOTIFY_EMAIL,
    netlify_token_set: !!process.env.NETLIFY_ACCESS_TOKEN,
  };

  // 4) optional live email test
  if (testEmail) {
    if (!process.env.RESEND_API_KEY) out.email_test = "SKIPPED — no RESEND_API_KEY set.";
    else {
      try {
        const from = process.env.NOTIFY_FROM || "Ascension <onboarding@resend.dev>";
        const url = process.env.URL || "https://ascensionldn.co.uk";
        // send the REAL "Application Received" confirmation so we see exactly where it lands
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)" },
          body: JSON.stringify({ from, to: [testEmail], subject: "Application Received | A Night With Ascension", html: confirmationEmail({ first_name: "there", email: testEmail }, url) }),
        });
        const body = await res.text();
        out.email_test = res.ok ? `SENT the real 'Application Received' email to ${testEmail} — CHECK INBOX AND SPAM/JUNK` : `FAILED (${res.status}): ${body.slice(0, 300)}`;
      } catch (e) {
        out.email_test = "FAILED: " + (e && e.message ? e.message : String(e));
      }
    }
  }

  const rows = Object.entries(out).map(([k, v]) =>
    `<tr><td style="padding:10px 20px 10px 0;color:#8a8a8a;font-size:12px;letter-spacing:.1em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${k}</td>
     <td style="padding:10px 0;color:#f4f1ec;font-size:14px;">${typeof v === "object" ? "<pre style='margin:0;font-family:monospace;white-space:pre-wrap;'>" + JSON.stringify(v, null, 2) + "</pre>" : String(v)}</td></tr>`
  ).join("");
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
  <body style="background:#060606;color:#f4f1ec;font-family:system-ui,sans-serif;padding:40px 24px;">
    <h1 style="font-weight:300;letter-spacing:.3em;text-transform:uppercase;font-size:18px;">Ascension — Self-check</h1>
    <table style="border-collapse:collapse;margin-top:20px;max-width:680px;">${rows}</table>
  </body>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};
