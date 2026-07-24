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

## How applications flow (Netlify Blobs — no cap)

The form posts to **`/.netlify/functions/register`**, which stores each
application in **Netlify Blobs** (no monthly limit — the old 100/month Netlify
Forms cap is gone) and sends the guest confirmation + a team alert via Resend.
The admin reads everything through `applications.mjs`, which merges the Blobs
applications with the first ~100 legacy Netlify Forms submissions (via the
Netlify API token) so no history is lost.

A hidden honeypot field (`company`) blocks bots. `instagramCheckUrl` in
`js/app.js` stays optional (CORS means the site validates handle *format* by
default).

## The guest pipeline

Each guest moves through colour-coded statuses, all driven from the admin:

1. **Received** — application stored; guest gets "Application Received".
2. **Invited** — admin taps **Accept** → the Invitation email sends with a
   personal **Confirm Attendance** button (and a decline link). No QR codes.
3. **Confirmed** — guest opens `/confirm.html?id=…&t=<token>`, sees the event
   details/dress code/photography notice/terms, and taps **Confirm Attendance**.
4. **Ticketed (Digital Invitation Issued)** — confirmation mints a unique
   ticket reference `ANWA-<NN><DDMMYY>` (e.g. `ANWA-01310726`) and emails the
   premium digital invitation (card, not ticket — no QR). Shown on the page too.
5. **Declined** — admin decline (silent) or guest declines via the email link.
6. **Waitlisted** — admin taps **Waitlist** → the priority-waitlist email sends.

Functions: `register.mjs`, `guest-status.mjs` (accept/waitlist/decline/resend/
undo), `rsvp.mjs` (guest view/confirm/decline + ticket minting), `settings.mjs`
(event details), plus the shared `lib/shared.mjs`. State lives in Netlify Blobs.

## Admin dashboard (`/admin.html`)

Password-gated. Pipeline stats, search, source/occupation/status filters,
colour-coded status pills, ticket references, per-guest actions, door check-in,
CSV export, and the Communications Centre. One-time setup:

1. Netlify → avatar → **User settings → Applications → Personal access tokens →
   New access token** → copy it (used only to read the ~100 legacy Forms rows).
2. **Project configuration → Environment variables** → add `ADMIN_PASSWORD`
   (your password) and `NETLIFY_ACCESS_TOKEN` (the token). `RESEND_API_KEY`,
   `NOTIFY_FROM`, `NOTIFY_EMAIL` should already be set from the email step.
3. **Deploys → Trigger deploy**.

**Communications Centre:** reusable templates (Reminder, Cancellation, Waitlist,
General Announcement — plus the auto Invitation) editable in `templates.mjs`;
`broadcast.mjs` sends a chosen template to a recipient group (all / opted-in /
by status) via Resend's batch endpoint, personalising `{first_name}`, `{date}`,
`{arrival}`, `{venue}`.

**Event reminder:** `scheduled-reminder.mjs` runs daily and, a few days before
the event (`REMINDER_LEAD_DAYS`, default 3), emails all ticketed guests the
date/arrival/venue/dress-code reminder (idempotent per event date). The admin's
**Send event reminder now** button triggers the same send on demand.

**Door check-ins:** each row has a Check in button (name-based; admission is by
guest-list verification, no QR). Logged in Blobs via `checkin.mjs`, timestamped,
in the CSV. The admin installs as the **A· Door** app; the main site as
**Ascension**.

**Dependency:** `@netlify/blobs` is listed in `package.json`; Netlify installs
it at deploy. (A local in-memory stub under `node_modules` is used only for
offline tests and is git-ignored.)

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
