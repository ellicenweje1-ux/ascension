/**
 * Ascension admin API — returns guest applications from Netlify Forms.
 *
 * Security: requires the x-admin-key header to match the ADMIN_PASSWORD
 * environment variable. The Netlify API token stays server-side in
 * NETLIFY_ACCESS_TOKEN — it is never exposed to the browser.
 *
 * Required environment variables (Project configuration → Environment variables):
 *   ADMIN_PASSWORD        — the password for /admin.html (your choice)
 *   NETLIFY_ACCESS_TOKEN  — a Netlify personal access token
 *                           (User settings → Applications → New access token)
 */

const FORM_NAME = "ascension-applications";
const FIELDS = [
  "first_name", "surname", "email", "phone", "instagram",
  "occupation", "heard_from", "invited_by", "updates_optin",
];

exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  });

  const supplied = event.headers["x-admin-key"] || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password) return json(500, { error: "ADMIN_PASSWORD is not set on the site." });
  if (supplied !== password) return json(401, { error: "Incorrect password." });

  const token = process.env.NETLIFY_ACCESS_TOKEN;
  if (!token) return json(500, { error: "NETLIFY_ACCESS_TOKEN is not set on the site." });

  const siteId = process.env.SITE_ID;
  const headers = { Authorization: `Bearer ${token}` };

  const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, { headers });
  if (!formsRes.ok) return json(502, { error: `Could not reach Netlify (${formsRes.status}).` });
  const forms = await formsRes.json();
  const form = forms.find((f) => f.name === FORM_NAME);
  if (!form) return json(200, { submissions: [] }); // no submissions yet

  let page = 1;
  const all = [];
  for (;;) {
    const res = await fetch(
      `https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=100&page=${page}`,
      { headers }
    );
    if (!res.ok) return json(502, { error: `Could not load submissions (${res.status}).` });
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100 || page >= 30) break;
    page += 1;
  }

  const submissions = all.map((s) => {
    const row = { id: s.id, created_at: s.created_at };
    for (const f of FIELDS) row[f] = (s.data && s.data[f]) || "";
    return row;
  });

  return json(200, { submissions });
};
