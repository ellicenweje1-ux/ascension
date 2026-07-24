/**
 * Ascension admin API — guest applications merged with pipeline status
 * (review / invitation / confirmation / ticket) and door check-in state.
 * Auth: x-admin-key header = ADMIN_PASSWORD.
 */
import { checkAdmin, json, listApplications, getStatuses, stores } from "./lib/shared.mjs";

export default async (req) => {
  const auth = checkAdmin(req);
  if (!auth.ok) return auth.res;

  const apps = await listApplications();

  let statuses = {};
  let checkins = {};
  try {
    statuses = await getStatuses();
    checkins = (await stores.checkins().get("map", { type: "json" })) || {};
  } catch (e) {
    console.error("blobs read failed", e);
  }

  const submissions = apps.map((a) => {
    const st = statuses[a.id] || {};
    return {
      id: a.id,
      created_at: a.created_at,
      first_name: a.first_name || "",
      surname: a.surname || "",
      email: a.email || "",
      phone: a.phone || "",
      instagram: a.instagram || "",
      occupation: a.occupation || "",
      heard_from: a.heard_from || "",
      invited_by: a.invited_by || "",
      updates_optin: a.updates_optin || "",
      status: st.status || "pending",
      invited_at: st.invited_at || "",
      confirmed_at: st.confirmed_at || "",
      issued_at: st.issued_at || "",
      ticket_ref: st.ticket_ref || "",
      checked_in_at: (checkins[a.id] && checkins[a.id].at) || "",
    };
  });

  return json(200, { submissions });
};
