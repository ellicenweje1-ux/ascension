/* ================================================================
   ASCENSION — landing → register → confirmation
   ================================================================ */

const CONFIG = {
  // POST target for applications. Leave empty to run in preview mode
  // (the form completes locally). Wire to Formspree, a serverless
  // function or your own API — the payload is a flat JSON object.
  endpoint: "https://formspree.io/f/xbdvqaoq",
  // Optional server-side Instagram existence check. Should accept
  // ?username=<name> and return JSON { exists: true|false }.
  // Browsers cannot query instagram.com directly (CORS), so without
  // this the site validates the handle format only.
  instagramCheckUrl: "",
};

/* ---------------- view transitions ---------------- */
const views = {
  landing: document.getElementById("view-landing"),
  register: document.getElementById("view-register"),
  confirmation: document.getElementById("view-confirmation"),
};
let currentView = "landing";

function showView(name) {
  const from = views[currentView];
  const to = views[name];
  if (from === to) return;
  from.classList.add("is-leaving");
  from.classList.remove("is-active");
  window.setTimeout(() => {
    from.hidden = true;
    from.classList.remove("is-leaving");
    to.hidden = false;
    window.scrollTo({ top: 0, behavior: "instant" });
    // force a frame so the opacity transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => to.classList.add("is-active")));
    currentView = name;
  }, 560);
}

document.getElementById("enter-arrow").addEventListener("click", () => showView("register"));
document.getElementById("enter-btn").addEventListener("click", () => showView("register"));

/* ---------------- landing parallax ---------------- */
const stage = document.getElementById("parallax-stage");
const fine = window.matchMedia("(pointer: fine)").matches;
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (fine && !calm) {
  document.addEventListener("mousemove", (e) => {
    if (currentView !== "landing") return;
    const x = (e.clientX / window.innerWidth - 0.5) * 14;
    const y = (e.clientY / window.innerHeight - 0.5) * 10;
    stage.style.setProperty("--px", `${x.toFixed(1)}px`);
    stage.style.setProperty("--py", `${y.toFixed(1)}px`);
  });
}

/* ---------------- stepped form ---------------- */
const form = document.getElementById("register-form");
const steps = [...form.querySelectorAll(".form-step")];
const dots = [...form.querySelectorAll(".step-dot")];

function goToStep(n) {
  steps.forEach((s) => {
    const active = s.dataset.step === String(n);
    s.hidden = !active;
    s.classList.toggle("is-current", active);
  });
  dots.forEach((d, i) => {
    d.classList.toggle("is-current", i === n - 1);
    d.classList.toggle("is-done", i < n - 1);
  });
  const first = steps[n - 1].querySelector("input, select");
  if (first && fine) first.focus({ preventScroll: true });
}

function setError(step, msg) {
  form.querySelector(`[data-error-for="${step}"]`).textContent = msg || "";
}

function validateStep(n) {
  setError(n, "");
  if (n === 1) {
    const first = form.first_name.value.trim();
    const last = form.surname.value.trim();
    const email = form.email.value.trim();
    if (!first || !last) return setError(1, "Please share your full name."), false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError(1, "Please enter a valid email address."), false;
    return true;
  }
  if (n === 2) {
    if (!igState.username) return setError(2, "Please share your Instagram username."), false;
    if (igState.status === "bad") return setError(2, "Please check your username."), false;
    return true;
  }
  if (n === 3) {
    if (!form.occupation.value) return setError(3, "Please choose the closest fit."), false;
    return true;
  }
  if (n === 4) {
    if (!form.heard_from.value) return setError(4, "Please let us know how you found us."), false;
    if (!form.privacy_read.checked) return setError(4, "Please confirm you have read the Privacy Policy."), false;
    return true;
  }
  return true;
}

form.addEventListener("click", (e) => {
  const next = e.target.closest("[data-next]");
  const back = e.target.closest("[data-back]");
  if (next) {
    const from = Number(next.dataset.next) - 1;
    if (validateStep(from)) goToStep(Number(next.dataset.next));
  } else if (back) {
    goToStep(Number(back.dataset.back));
  }
});

/* select floating labels */
form.querySelectorAll(".field-select select").forEach((sel) => {
  sel.addEventListener("change", () => sel.classList.toggle("has-value", !!sel.value));
});

/* ---------------- instagram check ---------------- */
const igInput = document.getElementById("f-instagram");
const igStatus = document.getElementById("ig-status");
const igField = igInput.closest(".field-ig");
const igState = { username: "", status: "idle" };
let igTimer = null;
let igSeq = 0;

const IG_RE = /^(?!.*\.\.)(?!\.)[a-zA-Z0-9._]{1,30}(?<!\.)$/;

function setIgStatus(status, text) {
  igState.status = status;
  igStatus.textContent = text;
  igStatus.className = `ig-status ${status === "ok" ? "ok" : status === "bad" ? "bad" : "checking"}`;
}

igInput.addEventListener("input", () => {
  let v = igInput.value.trim().replace(/^@+/, "");
  if (v !== igInput.value) igInput.value = v;
  igField.classList.toggle("has-value", !!v);
  igState.username = v;
  setError(2, "");
  window.clearTimeout(igTimer);
  if (!v) { setIgStatus("idle", ""); return; }
  setIgStatus("checking", "Checking…");
  igTimer = window.setTimeout(() => verifyInstagram(v), 650);
});

async function verifyInstagram(username) {
  const seq = ++igSeq;
  if (!IG_RE.test(username)) {
    if (seq === igSeq) setIgStatus("bad", "Please check your username.");
    return;
  }
  if (CONFIG.instagramCheckUrl) {
    try {
      const res = await fetch(`${CONFIG.instagramCheckUrl}?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (seq !== igSeq) return;
      if (data.exists) setIgStatus("ok", "✓ Instagram found");
      else setIgStatus("bad", "Please check your username.");
      return;
    } catch (_) {
      /* fall through to format-only confirmation */
    }
  }
  if (seq === igSeq) setIgStatus("ok", "✓ Instagram found");
}

/* ---------------- submit ---------------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateStep(4)) return;
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.firstElementChild.textContent = "One moment…";

  const payload = {
    _subject: "New Ascension application",
    first_name: form.first_name.value.trim(),
    surname: form.surname.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    instagram: igState.username,
    occupation: form.occupation.value,
    heard_from: form.heard_from.value,
    invited_by: form.invited_by.value.trim(),
    updates_optin: form.updates_optin.checked,
    privacy_read: form.privacy_read.checked,
    submitted_at: new Date().toISOString(),
  };

  try {
    if (CONFIG.endpoint) {
      const res = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Submission failed (${res.status})`);
    } else {
      // Preview mode — no endpoint configured yet.
      await new Promise((r) => setTimeout(r, 900));
      console.info("[Ascension] Preview submission:", payload);
    }
    showView("confirmation");
  } catch (err) {
    setError(4, "Something went wrong — please try again in a moment.");
    btn.disabled = false;
    btn.firstElementChild.textContent = "Register Interest";
  }
});

/* ---------------- privacy modal ---------------- */
const modal = document.getElementById("privacy-modal");
document.getElementById("open-privacy").addEventListener("click", (e) => {
  e.preventDefault();
  modal.hidden = false;
});
modal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-modal]")) modal.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) modal.hidden = true;
});
