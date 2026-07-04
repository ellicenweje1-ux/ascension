# Ascension — A Night With Ascension

An immersive landing + register-interest experience for **Ascension**, the cultural
label exploring the intersection of music, fashion, art and community.

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

## Wiring the form (2 minutes)

Open `js/app.js` — the `CONFIG` block at the top:

- `endpoint` — where applications POST as JSON
  (`first_name, surname, email, phone, instagram, occupation, heard_from,
  invited_by, updates_optin, privacy_read, submitted_at`).
  A [Formspree](https://formspree.io) form URL works out of the box, as does any
  serverless function or API. **While empty, the site runs in preview mode** — the
  form completes locally and logs the payload to the console.
- `instagramCheckUrl` — optional. Browsers can't query instagram.com directly
  (CORS), so by default the site validates the handle's *format* and shows
  "✓ Instagram found". For a true existence check, point this at a tiny server
  endpoint that fetches `https://www.instagram.com/<username>/` and returns
  `{ "exists": true|false }` — the front-end already handles both answers.

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
