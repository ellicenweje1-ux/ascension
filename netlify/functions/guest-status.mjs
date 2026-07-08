/**
 * Ascension guest review — accept / decline / revert applications.
 * POST { id, status: "accepted"|"declined"|"pending",
 *        guest: { first_name, surname, email } }
 * Auth: x-admin-key header = ADMIN_PASSWORD.
 *
 * Accepting sends the "Welcome to Ascension" guest-list email (Resend),
 * built from the event settings saved in the admin portal, with a personal
 * QR code for door check-in, a maps button and add-to-calendar (Google link
 * + .ics attachment). If Resend isn't configured the status still saves and
 * the response says the email was skipped.
 */
import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const SLOGAN = "Music&nbsp;&nbsp;-&nbsp;&nbsp;Discovery&nbsp;&nbsp;-&nbsp;&nbsp;Culture";

function calendarBits(s) {
  // needs date_iso (YYYY-MM-DD); times HH:MM optional
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date_iso || "")) return null;
  const d = s.date_iso.replace(/-/g, "");
  const t = (hm, fallback) => (/^\d{2}:\d{2}$/.test(hm || "") ? hm.replace(":", "") + "00" : fallback);
  const start = t(s.doors_open, "190000");
  const end = t(s.end_time, "235900");
  const title = s.event_name || "A Night With Ascension";
  const loc = [s.venue_name, s.venue_address].filter(Boolean).join(", ");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${d}T${start}/${d}T${end}&location=${encodeURIComponent(loc)}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ascension//Guest List//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@ascension`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=Europe/London:${d}T${start}`,
    `DTEND;TZID=Europe/London:${d}T${end}`,
    `SUMMARY:${title}`,
    `LOCATION:${loc.replace(/,/g, "\\,")}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return { gcal, ics };
}

function acceptanceEmail(guest, s, siteUrl, qrUrl, cal) {
  const first = esc(guest.first_name || "there");
  const detail = (label, value) => value ? `<tr>
    <td style="padding:9px 0;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(244,241,236,0.42);width:110px;vertical-align:top;">${label}</td>
    <td style="padding:9px 0;font-size:14px;letter-spacing:0.04em;color:#f4f1ec;line-height:1.6;">${esc(value)}</td>
  </tr>` : "";
  const arrival = [s.doors_open && `Doors open ${s.doors_open}`, s.last_entry && `Last entry ${s.last_entry}`]
    .filter(Boolean).join("&nbsp;&nbsp;&bull;&nbsp;&nbsp;");
  return `
<div style="background-color:#060606;padding:52px 20px 60px;">
  <div style="max-width:520px;margin:0 auto;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <div style="text-align:center;padding-bottom:40px;">
      <img src="${siteUrl}/assets/wordmark-light.png" width="230" alt="ASCENSION" style="display:inline-block;width:230px;max-width:72%;height:auto;border:0;">
    </div>
    <div style="border-top:1px solid rgba(244,241,236,0.14);padding-top:40px;text-align:center;">
      <p style="margin:0 0 26px;font-size:20px;letter-spacing:0.34em;text-transform:uppercase;color:#f4f1ec;">Congratulations</p>
      <p style="margin:0 0 34px;font-size:15px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.72);">Hi ${first} — we are pleased to confirm your place on the guest list for <span style="color:#f4f1ec;">${esc(s.event_name || "A Night With Ascension")}</span>.</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(244,241,236,0.16);">
      <tr><td style="padding:30px 30px 24px;">
        <p style="margin:0 0 18px;font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(244,241,236,0.4);">The details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detail("Event", s.event_name || "A Night With Ascension")}
          ${detail("Date", s.date_text)}
          ${detail("Venue", [s.venue_name, s.venue_address].filter(Boolean).join(" — "))}
          ${arrival ? `<tr>
            <td style="padding:9px 0;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(244,241,236,0.42);width:110px;vertical-align:top;">Arrival</td>
            <td style="padding:9px 0;font-size:14px;letter-spacing:0.04em;color:#f4f1ec;line-height:1.6;">${arrival}<br><span style="color:rgba(244,241,236,0.5);font-size:12.5px;">Please arrive on time.</span></td>
          </tr>` : ""}
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;padding:38px 0 0;">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(244,241,236,0.4);">Your entry</p>
      <img src="${qrUrl}" width="150" height="150" alt="Your check-in code" style="display:inline-block;width:150px;height:150px;border:8px solid #f4f1ec;background:#ffffff;">
      <p style="margin:14px 0 0;font-size:12px;letter-spacing:0.06em;color:rgba(244,241,236,0.5);">Present this code on arrival for fast guest-list check-in.<br>This invitation is personal to you and non-transferable.</p>
    </div>
    <div style="text-align:center;padding:32px 0 0;">
      ${s.maps_url ? `<a href="${esc(s.maps_url)}" style="display:inline-block;margin:5px;padding:12px 26px;border:1px solid rgba(244,241,236,0.4);color:#f4f1ec;font-size:10px;letter-spacing:0.26em;text-transform:uppercase;text-decoration:none;">Open in Maps</a>` : ""}
      ${cal ? `<a href="${cal.gcal}" style="display:inline-block;margin:5px;padding:12px 26px;border:1px solid rgba(244,241,236,0.4);color:#f4f1ec;font-size:10px;letter-spacing:0.26em;text-transform:uppercase;text-decoration:none;">Add to Calendar</a>` : ""}
      ${s.spotify_url ? `<a href="${esc(s.spotify_url)}" style="display:inline-block;margin:5px;padding:12px 26px;border:1px solid rgba(244,241,236,0.4);color:#f4f1ec;font-size:10px;letter-spacing:0.26em;text-transform:uppercase;text-decoration:none;">The Soundtrack</a>` : ""}
    </div>
    <div style="padding:44px 0 0;text-align:center;">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(244,241,236,0.4);">Dress code</p>
      <p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:19px;color:#f4f1ec;">Contemporary Elegance</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.72);">Elevated eveningwear. Luxury streetwear welcomed when thoughtfully styled.</p>
      <p style="margin:0;font-size:11.5px;line-height:2;letter-spacing:0.08em;text-transform:uppercase;color:rgba(244,241,236,0.45);">No sportswear&nbsp;&nbsp;&bull;&nbsp;&nbsp;No caps&nbsp;&nbsp;&bull;&nbsp;&nbsp;No offensive branding</p>
    </div>
    <div style="padding:40px 0 0;text-align:center;">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(244,241,236,0.4);">Photography</p>
      <p style="margin:0;font-size:13px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.6);">Professional photography and videography will take place throughout the evening. By attending you acknowledge that imagery may be used across Ascension's marketing channels. If you have concerns, please notify a member of staff upon arrival.</p>
    </div>
    <div style="padding:36px 0 0;text-align:center;">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(244,241,236,0.4);">The atmosphere</p>
      <p style="margin:0;font-size:13px;line-height:1.9;letter-spacing:0.02em;color:rgba(244,241,236,0.6);">Ascension exists to celebrate music, creativity and community. We ask every guest to contribute positively to the atmosphere and respect both the venue and fellow attendees.</p>
    </div>
    <div style="padding:34px 0 0;text-align:center;">
      <p style="margin:0;font-size:11px;line-height:2.1;letter-spacing:0.05em;color:rgba(244,241,236,0.35);">No excessive intoxication&nbsp;&nbsp;&bull;&nbsp;&nbsp;Management reserve the right to refuse entry<br>Invitation is non-transferable&nbsp;&nbsp;&bull;&nbsp;&nbsp;Government ID may be requested</p>
    </div>
    <div style="padding:46px 0 0;text-align:center;">
      <p style="margin:0 0 10px;font-size:14px;letter-spacing:0.5em;text-transform:uppercase;color:#f4f1ec;">Ascension</p>
      <p style="margin:0 0 42px;font-size:10px;letter-spacing:0.34em;text-transform:uppercase;line-height:2.2;color:rgba(244,241,236,0.45);">${SLOGAN}</p>
      <p style="margin:0;font-size:11px;line-height:1.8;letter-spacing:0.04em;color:rgba(244,241,236,0.32);">This email was sent because you registered your interest for an Ascension event.</p>
    </div>
  </div>
</div>`;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  const supplied = req.headers.get("x-admin-key") || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password || supplied !== password) return json(401, { error: "Incorrect password." });

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const id = String(body.id || "");
  const status = String(body.status || "");
  const guest = body.guest || {};
  if (!id || !["accepted", "declined", "pending"].includes(status)) {
    return json(422, { error: "Missing id or invalid status." });
  }

  const store = getStore("statuses");
  const map = (await store.get("map", { type: "json" })) || {};

  let emailed = false;
  let emailNote = "";

  if (status === "pending") {
    delete map[id];
  } else {
    map[id] = { status, at: new Date().toISOString() };
  }

  if (status === "accepted") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_FROM;
    if (key && from && guest.email) {
      const settings = (await getStore("settings").get("event", { type: "json" })) || {};
      const siteUrl = process.env.URL || "https://ascensionldn.co.uk";
      const qrData = `${siteUrl}/admin.html#guest=${id}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(qrData)}`;
      const cal = calendarBits(settings);
      const msg = {
        from,
        to: [guest.email],
        subject: "Welcome to Ascension.",
        html: acceptanceEmail(guest, settings, siteUrl, qrUrl, cal),
      };
      if (cal) {
        msg.attachments = [{
          filename: "ascension.ics",
          content: Buffer.from(cal.ics).toString("base64"),
        }];
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; AscensionSite/1.0)",
        },
        body: JSON.stringify(msg),
      });
      if (res.ok) {
        emailed = true;
        map[id].invited_at = new Date().toISOString();
      } else {
        emailNote = `Accepted, but the invite email failed (${res.status}).`;
        console.error("Resend error", res.status, await res.text().catch(() => ""));
      }
    } else {
      emailNote = "Accepted — invite email skipped (email service not configured or guest has no email).";
    }
  }

  await store.setJSON("map", map);
  return json(200, { id, status, entry: map[id] || null, emailed, note: emailNote });
};
