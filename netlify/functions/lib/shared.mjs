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

export async function hashPassword(pw, salt) {
  const data = new TextEncoder().encode(`${salt}:${pw}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A custom password (stored hashed in Blobs) overrides the ADMIN_PASSWORD env var.
export async function verifyPassword(supplied) {
  let stored = null;
  try { stored = await stores.auth().get("pw", { type: "json" }); } catch {}
  if (stored && stored.hash) return (await hashPassword(supplied, stored.salt || "")) === stored.hash;
  const password = process.env.ADMIN_PASSWORD || "";
  return !!password && supplied === password;
}

export async function checkAdmin(req) {
  const supplied = req.headers.get("x-admin-key") || "";
  if (await verifyPassword(supplied)) return { ok: true };
  return { ok: false, res: json(401, { error: "Incorrect password." }) };
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
  auth: () => getStore("auth"),
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

/* ---- editable email templates (Communications Centre) ---- */
export const DEFAULTS = {
  invitation: {
    name: "Invitation (Acceptance)",
    tokened: true, // sent per-guest on Accept; carries the Confirm Attendance button
    subject: "You're invited | A Night With Ascension",
    body: `Hi {first_name},

Thank you for your application to Ascension. We're pleased to let you know that your application has been successful, and we'd like to invite you to join us for {event}.

Date: {date}
Venue: {venue}
Arrival: {arrival}

Dress code — Contemporary Elegance. Elevated eveningwear; luxury streetwear welcomed when thoughtfully styled.

Photography and video take place throughout the evening; by attending you acknowledge that imagery may be used across Ascension's channels. Admission is reserved exclusively for the named guest and invitations cannot be transferred or shared.

Your place has been reserved. Please confirm your attendance below — once confirmed, you'll receive your official digital invitation and unique ticket reference.`,
  },
  reminder: {
    name: "Reminder",
    subject: "A Night With Ascension — a few days to go",
    body: "Hi {first_name},\n\nA note ahead of {event}.\n\nDate: {date}\nArrival: {arrival}\nVenue: {venue}\n\nDress code: Contemporary Elegance — elevated eveningwear.\n\nPlease arrive within your arrival window. We look forward to welcoming you.",
  },
  cancellation: {
    name: "Cancellation",
    subject: "A Night With Ascension — an update",
    body: "Hi {first_name},\n\nWe're writing to let you know about a change to {event}.\n\n[Add your message here.]\n\nWith thanks,\nAscension",
  },
  waitlist: {
    name: "Waitlist",
    tokened: true, // also sent from the Waitlist action on a guest
    subject: "Ascension — Priority Waitlist",
    body: "Hi {first_name},\n\nThank you for your interest in Ascension and for taking the time to submit an application.\n\nDue to the level of interest in this event, we have now reached our current guest capacity. Rather than closing your application, we have placed you on our priority waitlist.\n\nShould additional places become available, or if confirmed guests are no longer able to attend, we will contact waitlisted applicants in the order that spaces become available.\n\nYour application will also remain active for future Ascension events, where priority consideration may be given to guests who have previously registered their interest.\n\nThank you for being part of the Ascension community.",
  },
  announcement: {
    name: "General Announcement",
    subject: "A note from Ascension",
    body: "Hi {first_name},\n\n[Your announcement here.]\n\nAscension\nMusic · Discovery · Culture",
  },
};

export async function loadTemplate(key) {
  const def = DEFAULTS[key] || {};
  let saved = {};
  try { saved = (await stores.templates().get("map", { type: "json" })) || {}; } catch {}
  const s = saved[key] || {};
  return { subject: s.subject || def.subject || "", body: s.body || def.body || "", name: def.name || key };
}

export function fillVars(text, vars) {
  let t = String(text || "");
  for (const [k, v] of Object.entries(vars || {})) t = t.split(`{${k}}`).join(v == null ? "" : String(v));
  return t;
}
export function proseParagraphs(text) {
  return String(text || "").split(/\n{2,}/).filter((p) => p.trim()).map((p) =>
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.82);">${esc(p).replace(/\n/g, "<br>")}</p>`
  ).join("");
}
export function proseEmail(url, text, vars) {
  return shell(url, `<div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;">${proseParagraphs(fillVars(text, vars))}</div>`);
}
export function invitationEmailHtml(url, text, vars, confirmUrl, declineUrl) {
  const inner = `<div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;">
    ${proseParagraphs(fillVars(text, vars))}
    <div style="text-align:center;padding:10px 0 6px;">${button("Confirm Attendance", confirmUrl)}</div>
    <p style="margin:8px 0 6px;text-align:center;font-size:12px;letter-spacing:0.06em;color:rgba(244,241,236,0.5);">Unable to attend? <a href="${esc(declineUrl)}" style="color:rgba(244,241,236,0.85);">Let us know here.</a></p>
  </div>`;
  return shell(url, inner);
}

export function eventVars(settings) {
  return {
    event: settings.event_name || "A Night With Ascension",
    date: settings.date_text || "",
    venue: [settings.venue_name, settings.venue_address].filter(Boolean).join(", "),
    arrival: [settings.doors_open && `Doors open ${settings.doors_open}`, settings.last_entry && `Last entry ${settings.last_entry}`].filter(Boolean).join(" · "),
  };
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
