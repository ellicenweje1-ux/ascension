/**
 * Ascension — automatic event reminder (scheduled daily).
 * A few days before the event it emails every ticketed (issued) guest a
 * reminder: date, arrival window, venue address, dress code and final notes.
 * Idempotent per event date via a flag in Blobs. Also callable by an admin
 * with x-admin-key + {force:true} to send immediately.
 */
import {
  json, esc, siteUrl, fromAddress, shell, para, label,
  getSettings, getStatuses, listApplications, stores,
} from "./lib/shared.mjs";

const LEAD_DAYS = Number(process.env.REMINDER_LEAD_DAYS || 3);

function reminderHtml(first, s, url) {
  const venue = [s.venue_name, s.venue_address].filter(Boolean).join(", ");
  const arrival = [s.doors_open && `Doors open ${s.doors_open}`, s.last_entry && `Last entry ${s.last_entry}`].filter(Boolean).join("  ·  ");
  const inner = `<div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;">
    ${para(`Hi ${esc(first || "there")},`)}
    ${para(`A short note ahead of <span style="color:#f4f1ec;">${esc(s.event_name || "A Night With Ascension")}</span>.`, true)}
    <div style="margin:6px 0 6px;">${label("The details")}</div>
    ${s.date_text ? `<p style="margin:0 0 6px;font-size:14px;color:#f4f1ec;"><span style="color:rgba(244,241,236,0.5);">Date:</span> ${esc(s.date_text)}</p>` : ""}
    ${arrival ? `<p style="margin:0 0 6px;font-size:14px;color:#f4f1ec;"><span style="color:rgba(244,241,236,0.5);">Arrival:</span> ${esc(arrival)}</p>` : ""}
    ${venue ? `<p style="margin:0 0 26px;font-size:14px;color:#f4f1ec;line-height:1.6;"><span style="color:rgba(244,241,236,0.5);">Venue:</span> ${esc(venue)}</p>` : ""}
    <div style="margin:8px 0 6px;">${label("Dress code")}</div>
    <p style="margin:0 0 8px;font-family:Georgia,serif;font-style:italic;font-size:17px;color:#f4f1ec;">Contemporary Elegance</p>
    ${para(`Elevated eveningwear. Luxury streetwear welcomed when thoughtfully styled. Please arrive within your arrival window.`, true)}
    <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:17px;color:#f4f1ec;">We look forward to welcoming you.</p>
  </div>`;
  return shell(url, inner);
}

async function runReminders(url, force) {
  const s = await getSettings();
  const m = (s.date_iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ok: false, note: "No event date set." };

  if (!force) {
    const eventDay = new Date(`${s.date_iso}T00:00:00Z`).getTime();
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
    const days = Math.round((eventDay - today) / 864e5);
    if (days < 0 || days > LEAD_DAYS) return { ok: true, note: `Not in reminder window (${days} days out).`, sent: 0 };
    const flag = await stores.flags().get("reminder_sent", { type: "text" });
    if (flag === s.date_iso) return { ok: true, note: "Reminder already sent for this event.", sent: 0 };
  }

  if (!process.env.NOTIFY_FROM || !process.env.RESEND_API_KEY) return { ok: false, note: "Email not configured." };

  const apps = await listApplications();
  const statuses = await getStatuses();
  const recipients = apps.filter((a) => a.email && ((statuses[a.id] && statuses[a.id].status) === "issued"));
  const from = fromAddress();
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100).map((a) => ({
      from, to: [a.email], subject: `${s.event_name || "A Night With Ascension"} — a few days to go`,
      html: reminderHtml(a.first_name, s, url),
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)" },
      body: JSON.stringify(chunk),
    });
    if (res.ok) sent += chunk.length;
  }
  await stores.flags().set("reminder_sent", s.date_iso);
  return { ok: true, sent, note: `Reminder sent to ${sent} guest(s).` };
}

export default async (req) => {
  // manual trigger (admin)
  if (req && req.headers && req.headers.get) {
    const key = req.headers.get("x-admin-key");
    if (key) {
      if (key !== (process.env.ADMIN_PASSWORD || "")) return json(401, { error: "Incorrect password." });
      let b = {};
      try { b = await req.json(); } catch (_) {}
      const r = await runReminders(siteUrl(req), !!b.force);
      return json(200, r);
    }
  }
  // scheduled run
  const r = await runReminders(process.env.URL || "https://ascensionldn.co.uk", false);
  console.log("scheduled-reminder:", r.note);
  return new Response("ok");
};

export const config = { schedule: "0 10 * * *" };
