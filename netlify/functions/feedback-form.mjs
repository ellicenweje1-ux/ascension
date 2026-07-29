/**
 * Ascension — feedback form definition + collected responses (admin).
 * GET  -> { form, responses, count }
 * POST -> save { intro, questions:[{id,q,type,options?}] }
 * Auth: x-admin-key = the admin password.
 */
import {
  checkAdmin, json, getFeedbackForm, saveFeedbackForm, getFeedbackResponses, randToken,
} from "./lib/shared.mjs";

const TYPES = ["single", "multi", "text"];

export default async (req) => {
  const auth = await checkAdmin(req);
  if (!auth.ok) return auth.res;

  if (req.method === "GET") {
    const [form, responses] = await Promise.all([getFeedbackForm(), getFeedbackResponses()]);
    return json(200, { form, responses, count: responses.length });
  }

  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const clean = {
      intro: String(body.intro || "").slice(0, 1000),
      questions: questions.slice(0, 30).map((q) => {
        const type = TYPES.includes(q.type) ? q.type : "single";
        const out = {
          id: String(q.id || "").trim() || `q_${randToken(6)}`,
          q: String(q.q || "").slice(0, 300),
          type,
        };
        if (type !== "text") {
          out.options = (Array.isArray(q.options) ? q.options : [])
            .map((o) => String(o).slice(0, 200)).filter((o) => o.trim()).slice(0, 20);
        }
        return out;
      }).filter((q) => q.q.trim()),
    };
    await saveFeedbackForm(clean);
    return json(200, { ok: true, form: clean });
  }

  return json(405, { error: "GET or POST only." });
};
