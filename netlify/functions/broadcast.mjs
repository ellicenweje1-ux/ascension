/**
 * Ascension — Communications Centre broadcast.
 * POST { key, group, test_to? }  (auth: x-admin-key = ADMIN_PASSWORD)
 *   key   — a template key (reminder | cancellation | waitlist | announcement)
 *   group — recipient group: all | pending | invited | confirmed | issued |
 *           waitlisted | declined | optin
 *   test_to — if set, sends a single preview to that address instead
 * Sends via Resend's batch endpoint (100 per call). Personalises {first_name},
 * {date}, {arrival}, {venue} and wraps the body in the Ascension email shell.
 */
import {
  checkAdmin, json, esc, siteUrl, fromAddress, shell, getSettings,
  getStatuses, listApplications,
} from "./lib/shared.mjs";
import { DEFAULTS } from "./templates.mjs";

function bodyToHtml(text, vars) {
  let t = String(text || "");
  for (const [k, v] of Object.entries(vars)) t = t.split(`{${k}}`).join(esc(v || ""));
  // paragraphs from blank lines, <br> within
  return t.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.82);">${esc(p).replace(/\n/g, "<br>")}</p>`
  ).join("");
}

function emailHtml(url, text, vars) {
  return shell(url, `<div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;">${bodyToHtml(text, vars)}</div>`);
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const auth = checkAdmin(req);
  if (!auth.ok) return auth.res;
  if (!process.env.NOTIFY_FROM) return json(400, { error: "Email is not configured (NOTIFY_FROM)." });

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const key = String(body.key || "");
  const group = String(body.group || "");
  const testTo = String(body.test_to || "").trim();
  const tpl = DEFAULTS[key];
  if (!tpl) return json(422, { error: "Unknown template." });
  if (key === "invitation") return json(422, { error: "The invitation is sent automatically per guest and can't be broadcast." });

  // resolve subject/body (saved override or default)
  const store = (await import("./lib/shared.mjs")).stores.templates();
  const saved = (await store.get("map", { type: "json" })) || {};
  const subject = (saved[key] && saved[key].subject) || tpl.subject;
  const rawBody = (saved[key] && saved[key].body) || tpl.body;

  const settings = await getSettings();
  const url = siteUrl(req);
  const from = fromAddress();
  const commonVars = {
    date: settings.date_text || "",
    venue: [settings.venue_name, settings.venue_address].filter(Boolean).join(", "),
    arrival: [settings.doors_open && `Doors open ${settings.doors_open}`, settings.last_entry && `Last entry ${settings.last_entry}`].filter(Boolean).join(" · "),
  };

  // test send
  if (testTo) {
    const html = emailHtml(url, rawBody, { first_name: "there", ...commonVars });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)" },
      body: JSON.stringify({ from, to: [testTo], subject, html }),
    });
    return json(res.ok ? 200 : 502, res.ok ? { ok: true, test: true } : { error: `Test send failed (${res.status}).` });
  }

  // resolve recipients
  const apps = await listApplications();
  const statuses = await getStatuses();
  const recipients = apps.filter((a) => {
    if (!a.email) return false;
    const st = (statuses[a.id] && statuses[a.id].status) || "pending";
    if (group === "all") return true;
    if (group === "optin") return (a.updates_optin || "").toLowerCase() === "yes";
    return st === group;
  });
  if (!recipients.length) return json(200, { ok: true, sent: 0, note: "No matching recipients." });

  // batch send (100 per Resend call)
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100).map((a) => ({
      from, to: [a.email], subject,
      html: emailHtml(url, rawBody, { first_name: a.first_name || "there", ...commonVars }),
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)" },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
    else console.error("batch send failed", res.status, await res.text().catch(() => ""));
  }

  return json(200, { ok: true, sent, total: recipients.length });
};
