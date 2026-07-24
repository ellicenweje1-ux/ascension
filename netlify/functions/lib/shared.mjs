/**
 * Ascension — shared helpers for the serverless functions.
 * (Lives in a subdirectory so Netlify does not treat it as an endpoint.)
 */
import { getStore } from "@netlify/blobs";

export const SLOGAN = "Music&nbsp;&nbsp;-&nbsp;&nbsp;Discovery&nbsp;&nbsp;-&nbsp;&nbsp;Culture";
export const INSTAGRAM = "https://instagram.com/ascensionlondon";

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

export function siteUrl(req) {
  return process.env.URL || "https://ascensionldn.co.uk";
}

export function checkAdmin(req) {
  const supplied = req.headers.get("x-admin-key") || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password) return { ok: false, res: json(500, { error: "ADMIN_PASSWORD is not set on the site." }) };
  if (supplied !== password) return { ok: false, res: json(401, { error: "Incorrect password." }) };
  return { ok: true };
}

export function randToken(n = 20) {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  let s = "";
  const buf = crypto.getRandomValues(new Uint8Array(n));
  for (let i = 0; i < n; i++) s += a[buf[i] % a.length];
  return s;
}

/* ---- stores ---- */
export const stores = {
  applications: () => getStore("applications"),
  statuses: () => getStore("statuses"),
  checkins: () => getStore("checkins"),
  settings: () => getStore("settings"),
  templates: () => getStore("templates"),
  sequence: () => getStore("sequence"),
  flags: () => getStore("flags"),
};

export async function getSettings() {
  try { return (await stores.settings().get("event", { type: "json" })) || {}; }
  catch { return {}; }
}
export async function getStatuses() {
  try { return (await stores.statuses().get("map", { type: "json" })) || {}; }
  catch { return {}; }
}
export async function saveStatuses(map) {
  await stores.statuses().setJSON("map", map);
}

/* ---- email ---- */
export async function sendEmail(msg) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "email service not configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)",
    },
    body: JSON.stringify(msg),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Resend error", res.status, text);
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

export function fromAddress() {
  return process.env.NOTIFY_FROM || "Ascension <onboarding@resend.dev>";
}

/* ---- email shell + fragments (dark, brand-consistent) ---- */
export function shell(url, inner) {
  return `<div style="background-color:#060606;padding:52px 20px 60px;">
  <div style="max-width:520px;margin:0 auto;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <div style="text-align:center;padding-bottom:40px;">
      <img src="${url}/assets/wordmark-light.png" width="230" alt="ASCENSION" style="display:inline-block;width:230px;max-width:72%;height:auto;border:0;">
    </div>
    ${inner}
    <div style="padding:46px 0 0;text-align:center;">
      <p style="margin:0 0 10px;font-size:14px;letter-spacing:0.5em;text-transform:uppercase;color:#f4f1ec;">Ascension</p>
      <p style="margin:0 0 42px;font-size:10px;letter-spacing:0.34em;text-transform:uppercase;line-height:2.2;color:rgba(244,241,236,0.45);">${SLOGAN}</p>
      <p style="margin:0;font-size:11px;line-height:1.8;letter-spacing:0.04em;color:rgba(244,241,236,0.32);">This email was sent because you registered your interest for an Ascension event.</p>
    </div>
  </div>
</div>`;
}

export function button(label, href) {
  return `<a href="${esc(href)}" style="display:inline-block;margin:5px;padding:15px 40px;background:#f4f1ec;color:#060606;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;text-decoration:none;font-weight:600;">${label}</a>`;
}
export function outlineButton(label, href) {
  return `<a href="${esc(href)}" style="display:inline-block;margin:5px;padding:14px 34px;border:1px solid rgba(244,241,236,0.4);color:#f4f1ec;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;text-decoration:none;">${label}</a>`;
}
export function para(text, dim) {
  return `<p style="margin:0 0 22px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:${dim ? "rgba(244,241,236,0.72)" : "#f4f1ec"};">${text}</p>`;
}
export function label(text) {
  return `<p style="margin:0 0 16px;font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(244,241,236,0.4);">${text}</p>`;
}

/* ---- ticket reference: ANWA-<NN><DDMMYY> ---- */
export function eventCode(settings) {
  // DDMMYY from date_iso (YYYY-MM-DD); falls back to blanks if unset
  const m = (settings.date_iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return m[3] + m[2] + m[1].slice(2);
}
export async function nextTicketRef(settings) {
  const store = stores.sequence();
  const cur = Number((await store.get("n", { type: "text" })) || "0");
  const n = cur + 1;
  await store.set("n", String(n));
  const nn = String(n).padStart(2, "0");
  const code = eventCode(settings);
  return `ANWA-${nn}${code}`;
}

/* ---- list all applications (Blobs) merged with legacy Netlify Forms ---- */
const APP_FIELDS = ["first_name", "surname", "email", "phone", "instagram", "occupation", "heard_from", "invited_by", "updates_optin"];

export async function listApplications() {
  const out = [];
  // 1) Blobs applications (the new, uncapped store)
  try {
    const store = stores.applications();
    const { blobs } = await store.list();
    const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)));
    for (const r of rows) if (r && r.id) out.push(r);
  } catch (e) {
    console.error("blobs applications list failed", e);
  }
  // 2) Legacy Netlify Forms submissions (the first ~100), if a token is present
  const token = process.env.NETLIFY_ACCESS_TOKEN;
  const siteId = process.env.SITE_ID;
  if (token && siteId) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, { headers });
      if (formsRes.ok) {
        const forms = await formsRes.json();
        const form = forms.find((f) => f.name === "ascension-applications");
        if (form) {
          let page = 1;
          for (;;) {
            const res = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=100&page=${page}`, { headers });
            if (!res.ok) break;
            const batch = await res.json();
            for (const s of batch) {
              const row = { id: s.id, created_at: s.created_at, legacy: true };
              for (const f of APP_FIELDS) row[f] = (s.data && s.data[f]) || "";
              out.push(row);
            }
            if (batch.length < 100 || page >= 30) break;
            page += 1;
          }
        }
      }
    } catch (e) {
      console.error("legacy forms read failed", e);
    }
  }
  return out;
}
