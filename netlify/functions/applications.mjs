/**
 * Ascension admin API — guest applications merged with door check-in state.
 * Auth: x-admin-key header must equal the ADMIN_PASSWORD env var.
 * Env: ADMIN_PASSWORD, NETLIFY_ACCESS_TOKEN (stays server-side).
 */
import { getStore } from "@netlify/blobs";

const FORM_NAME = "ascension-applications";
const FIELDS = [
  "first_name", "surname", "email", "phone", "instagram",
  "occupation", "heard_from", "invited_by", "updates_optin",
];

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const supplied = req.headers.get("x-admin-key") || "";
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

  let all = [];
  if (form) {
    let page = 1;
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
  }

  let checkins = {};
  let statuses = {};
  try {
    checkins = (await getStore("checkins").get("map", { type: "json" })) || {};
    statuses = (await getStore("statuses").get("map", { type: "json" })) || {};
  } catch (e) {
    console.error("blobs read failed", e);
  }

  const submissions = all.map((s) => {
    const row = { id: s.id, created_at: s.created_at };
    for (const f of FIELDS) row[f] = (s.data && s.data[f]) || "";
    row.checked_in_at = (checkins[s.id] && checkins[s.id].at) || "";
    const st = statuses[s.id] || {};
    row.status = st.status || "pending";
    row.invited_at = st.invited_at || "";
    return row;
  });

  return json(200, { submissions });
};
