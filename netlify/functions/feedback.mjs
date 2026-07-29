/**
 * Ascension — attendee feedback (public, token-protected).
 * POST { id, t, action }
 *   action "view"   -> returns the form + guest first name + whether already answered
 *   action "submit" -> stores this guest's answers (one record per guest)
 * The token (t) must match the guest's invitation token, so only real guests
 * who received the personal link can submit, and answers are attributable.
 */
import {
  json, getStatus, getFeedbackForm, getSettings, stores,
} from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const id = String(body.id || "");
  const t = String(body.t || "");
  const action = String(body.action || "view");

  // Admin/preview: return just the form definition (questions aren't sensitive). No responses, no guest data.
  if (action === "preview") {
    const form = await getFeedbackForm();
    const settings = await getSettings();
    return json(200, { first_name: "", event_name: settings.event_name || "A Night With Ascension", form, already_submitted: false, preview: true });
  }

  if (!id || !t) return json(400, { error: "This link is missing information." });

  const entry = await getStatus(id);
  if (!entry || !entry.token || entry.token !== t) {
    return json(403, { error: "We couldn't open this feedback link. Please use the most recent email we sent you, or reply to it and we'll help." });
  }

  const form = await getFeedbackForm();
  const settings = await getSettings();
  const g = entry.guest || {};

  if (action === "view") {
    let answered = false;
    try { answered = !!(await stores.feedbackResponses().get(id, { type: "json" })); } catch {}
    return json(200, {
      first_name: g.first_name || "",
      event_name: settings.event_name || "A Night With Ascension",
      form,
      already_submitted: answered,
    });
  }

  if (action === "submit") {
    const answers = (body.answers && typeof body.answers === "object") ? body.answers : {};
    // keep only answers to known questions; cap text length
    const clean = {};
    for (const q of form.questions || []) {
      const v = answers[q.id];
      if (v == null) continue;
      if (q.type === "multi") clean[q.id] = (Array.isArray(v) ? v : [v]).map((x) => String(x).slice(0, 200)).slice(0, 20);
      else clean[q.id] = String(v).slice(0, 2000);
    }
    const record = {
      id,
      name: `${g.first_name || ""} ${g.surname || ""}`.trim(),
      at: new Date().toISOString(),
      answers: clean,
    };
    await stores.feedbackResponses().setJSON(id, record); // one record per guest (overwrites if re-submitted)
    return json(200, { ok: true });
  }

  return json(422, { error: "Unknown action." });
};
