# Ascension — A Night With Ascension

An immersive landing + register-interest experience for **Ascension**, the cultural
label exploring the intersection of music, art and community.

The whole journey lives in one page (`index.html`) so it flows seamlessly with no
page reloads:

1. **Landing** — black screen, film grain, drifting light, the arrow mark draws
   itself on and becomes the button to enter. "A Night With Ascension" and
   *Music • Discovery • Culture* fade in, then a minimal **Enter**. Mouse movement
   adds gentle parallax. No menu, no distractions.
2. **Register Your Interest** — a conversational, four-section form (name/contact →
   Instagram → occupation → discovery + consent) with progress hairlines, floating
   labels and inline validation. Includes the optional "Who invited you?" referral
   field and the updates/privacy checkboxes.
3. **Confirmation** — the logo disappears; the arrow ascends from below into the
   centre of the screen, then the thank-you copy fades in.

Everything is plain HTML/CSS/JS — no build step, no dependencies. Deploy the
`ascension/` folder to any static host (Render static site, Netlify, Vercel,
Cloudflare Pages, GitHub Pages).

## Files

```
index.html                       the full experience (landing / form / confirmation)
css/style.css                    all styling + animation
js/app.js                        view transitions, form steps, validation, submit
admin.html                       password-gated guest-list dashboard
netlify/functions/applications.js serverless API feeding the admin page
assets/wordmark.png / arrow.png  master logo files (originals, untouched)
assets/wordmark-light.png / arrow-light.png  ivory-white versions used by the site
assets/wordmark.svg / arrow.svg  vector recreations (spares)
assets/favicon.svg               browser tab mark
emails/application-received.html Email 1 — application received (dark, branded)
emails/guest-list-confirmation.html Email 2 — accepted / guest list confirmation
```

Both logo SVGs use `currentColor`, so they render white on dark or black on light
by CSS `color` alone — the artwork itself never changes.

The site uses the founder's master PNG logos: `assets/wordmark.png` and
`assets/arrow.png` are the untouched originals; `wordmark-light.png` /
`arrow-light.png` are the same artwork recoloured ivory-white and trimmed for the
dark site (colour is the only change). The earlier SVG recreations remain as
scalable spares. For the email header image, use the live site's copy:
`https://<your-site>/assets/wordmark-light.png` — but note it's white on
transparent, so it only shows on the dark email background (that's correct).

## How applications flow (Netlify Forms)

The form posts to **Netlify Forms** (the hidden form in `index.html` registers
the fields at deploy time). One-time setup on the Netlify project:

1. **Project configuration → Forms → Enable form detection**, then redeploy.
2. **Forms → Form notifications → Add notification → Email** — enter any inbox;
   every application emails there. Change it any time, no code involved.

Submissions are stored in the Netlify dashboard (Forms tab) and power the admin
page below. Free tier: 100 submissions/month.

**Email alerts (free route):** Netlify's built-in email notifications are
Pro-only, so `netlify/functions/submission-created.js` sends the alert instead —
Netlify runs it automatically on every submission. Set two more environment
variables to switch it on: `RESEND_API_KEY` (from a free resend.com account) and
`NOTIFY_EMAIL` (the address alerts go to — on Resend's free tier without a
verified domain this must be the email the Resend account was created with).
Without those variables it silently does nothing; submissions are stored either way.

`instagramCheckUrl` in `js/app.js` stays optional — browsers can't query
instagram.com directly (CORS), so by default the site validates the handle's
*format*; point this at a tiny endpoint returning `{ "exists": true|false }`
for a true existence check.

## Admin dashboard (`/admin.html`)

A password-gated guest-list view: stats (total / last 7 days / opted-in /
invited-by), search, source & occupation filters, Instagram links, CSV export.
It reads submissions through `netlify/functions/applications.js`, which keeps
the Netlify API token server-side. One-time setup:

1. Netlify → avatar (top right) → **User settings → Applications →
   Personal access tokens → New access token** → copy it.
2. On the project: **Project configuration → Environment variables** → add
   `ADMIN_PASSWORD` (your choice of password) and `NETLIFY_ACCESS_TOKEN`
   (the token from step 1).
3. **Deploys → Trigger deploy** so the variables take effect.

Then open `https://<your-site>/admin.html` and unlock with the password.

**Door check-ins:** each guest row has a Check in button — tap it on arrival and
the attendance is logged (stored in Netlify Blobs via
`netlify/functions/checkin.mjs`, timestamped, undoable, included in the CSV and
the "Checked in at door" stat). The admin page installs to a phone home screen
as the **A· Door** app (`admin.webmanifest`); the main site installs as
**Ascension** (`site.webmanifest`).

**Guest confirmation email:** `submission-created.js` also sends the
"Application Received | A Night With Ascension" email to the guest
automatically — this needs `NOTIFY_FROM` on a Resend-verified domain.

**Review & accept (guest-list invites):** each admin row has Accept / Decline.
Accepting emails the guest "Welcome to Ascension." (via
`netlify/functions/guest-status.mjs`): event details from the admin's
"Event details" card (`settings.mjs`, stored in Blobs), the Contemporary
Elegance dress code, photography/respect notes, a personal QR code
(api.qrserver.com) that deep-links to `admin.html#guest=<id>` so the doorman
scanning it lands on that guest's row, a Google Maps button, Google Calendar
link and an `.ics` attachment (needs the ISO date filled in). Declines are
silent; both are undoable; status + invited time appear in the table and CSV.

## Emails

The two templates in `emails/` are self-contained dark HTML emails (inline styles,
table layout — safe for Gmail/Apple Mail/Outlook). Replace the `{{placeholders}}`
noted in each file's header comment, host a white-on-transparent `wordmark-light.png`
somewhere public for the header image, and send through any provider (Resend,
Mailchimp, Klaviyo…).

- **Email 1 — Application received:** confirmation + "under review" + Instagram /
  Website / Spotify soundtrack links.
- **Email 2 — Welcome to Ascension:** guest-list confirmation with event details
  card, QR check-in, maps + add-to-calendar buttons, the *Contemporary Elegance*
  dress code, photography notice, arrival window, house respect note and fine print.
