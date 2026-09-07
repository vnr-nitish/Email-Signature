import { backend } from "./backend.js";
import { requireAuth, wireLogout, getOrCreateProfile } from "./auth-guard.js";

wireLogout(document.getElementById("logout-btn"));

const form = document.getElementById("profile-form");
const fieldset = document.getElementById("fieldset");
const saveBtn = document.getElementById("save-btn");
const editBtn = document.getElementById("edit-btn");
const frozenNote = document.getElementById("frozen-note");
const successEl = document.getElementById("success");
const errorEl = document.getElementById("error");

const FIELDS = [
  "fullName",
  "program",
  "department",
  "school",
  "campus",
  "mobile",
  "website",
  "linkedin",
  "instagram",
  "youtube",
  "facebook",
  "twitter",
];

let currentUid = null;
let wasAlreadySubmitted = false;

function setLocked(locked) {
  fieldset.disabled = locked;
  saveBtn.hidden = locked;
  editBtn.hidden = !locked;
  frozenNote.hidden = !locked;
}

requireAuth(async (user) => {
  currentUid = user.uid;
  const { data } = await getOrCreateProfile(user.uid, user.email);
  FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el) el.value = data[key] || "";
  });
  wasAlreadySubmitted = Boolean(data.detailsSubmitted);
  setLocked(wasAlreadySubmitted);
});

editBtn.addEventListener("click", () => {
  setLocked(false);
  successEl.textContent = "";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  successEl.textContent = "";
  errorEl.textContent = "";

  const updates = { detailsSubmitted: true };
  FIELDS.forEach((key) => {
    updates[key] = document.getElementById(key).value.trim();
  });

  try {
    await backend.updateProfile(currentUid, updates);
    setLocked(true);
    successEl.innerHTML = wasAlreadySubmitted
      ? 'Saved. Click "Edit Details" any time to change these.'
      : 'Saved! Head to your <a href="dashboard.html">dashboard</a> to upload a photo and copy your signature.';
    wasAlreadySubmitted = true;
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
