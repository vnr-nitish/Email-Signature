import { backend } from "./backend.js";
import { requireAuth, wireLogout, getOrCreateProfile } from "./auth-guard.js";
import { buildSignatureHTML, FONT_OPTIONS } from "./signature-template.js";
import { openCropper } from "./photo-cropper.js";
import { copySignatureNode } from "./copy-signature.js";

wireLogout(document.getElementById("logout-btn"));

const photoFormWrap = document.getElementById("photo-form");
const photoInput = document.getElementById("photo");
const photoLockedView = document.getElementById("photo-locked-view");
const photoPreview = document.getElementById("photo-preview");
const changePhotoBtn = document.getElementById("change-photo-btn");
const photoSuccess = document.getElementById("photo-success");
const photoError = document.getElementById("photo-error");

const previewWithPhoto = document.getElementById("preview-with-photo");
const previewNoPhoto = document.getElementById("preview-no-photo");
const copyStatus = document.getElementById("copy-status");
const fontSelect = document.getElementById("font-select");

Object.keys(FONT_OPTIONS).forEach((name) => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  fontSelect.appendChild(option);
});

let currentUid = null;
let profile = null;
// A fresh value each time a photo is (re)uploaded, appended to the photo
// URL only for what's actually displayed/copied — never saved to the
// database. This guarantees every render request is a literally different
// URL, so no cache anywhere (this browser, a CDN in front of Storage,
// wherever) can have a matching stale entry to serve. The underlying
// stored profile.photoURL stays the clean, permanently-stable URL.
let photoCacheBust = Date.now();

function withCacheBust(url) {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${photoCacheBust}`;
}

function renderTemplates() {
  const displayProfile = profile.photoURL
    ? { ...profile, photoURL: withCacheBust(profile.photoURL) }
    : profile;
  previewWithPhoto.innerHTML = buildSignatureHTML(displayProfile, { withPhoto: true });
  previewNoPhoto.innerHTML = buildSignatureHTML(displayProfile, { withPhoto: false });
}

function setPhotoLocked(locked) {
  photoLockedView.hidden = !locked;
  photoFormWrap.hidden = locked;
}

requireAuth(async (user) => {
  currentUid = user.uid;
  const { data } = await getOrCreateProfile(user.uid, user.email);
  profile = data;

  if (profile.photoURL) {
    photoPreview.src = withCacheBust(profile.photoURL);
    setPhotoLocked(true);
  } else {
    setPhotoLocked(false);
  }

  fontSelect.value = profile.fontFamily || "Georgia";
  renderTemplates();

  fontSelect.addEventListener("change", async () => {
    profile = { ...profile, fontFamily: fontSelect.value };
    renderTemplates();
    await backend.updateProfile(currentUid, { fontFamily: fontSelect.value });
  });

  document.getElementById("copy-with-photo").addEventListener("click", async () => {
    const ok = await copySignatureNode(previewWithPhoto);
    copyStatus.textContent = ok
      ? "Copied! Paste it into Gmail: Settings > See all settings > Signature."
      : "Could not copy automatically — select the signature above and copy it manually (Ctrl+C).";
  });

  document.getElementById("copy-no-photo").addEventListener("click", async () => {
    const ok = await copySignatureNode(previewNoPhoto);
    copyStatus.textContent = ok
      ? "Copied! Paste it into Gmail: Settings > See all settings > Signature."
      : "Could not copy automatically — select the signature above and copy it manually (Ctrl+C).";
  });

  changePhotoBtn.addEventListener("click", () => {
    setPhotoLocked(false);
    photoSuccess.textContent = "";
  });

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    const cropped = await openCropper(file);
    photoInput.value = "";
    if (!cropped) return; // user cancelled

    photoSuccess.textContent = "";
    photoError.textContent = "";
    try {
      const photoURL = await backend.uploadPhoto(currentUid, cropped);
      profile = { ...profile, photoURL };
      photoCacheBust = Date.now();
      photoPreview.src = withCacheBust(photoURL);
      setPhotoLocked(true);
      renderTemplates();
      photoSuccess.textContent = "Photo saved.";
    } catch (err) {
      photoError.textContent = err.message;
    }
  });
});
