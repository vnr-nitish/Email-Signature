import { backend } from "./backend.js";
import { requireAuth, wireLogout, getOrCreateProfile } from "./auth-guard.js";
import { buildSignatureHTML, FONT_OPTIONS } from "./signature-template.js";
import { openCropper } from "./photo-cropper.js";

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

function renderTemplates() {
  previewWithPhoto.innerHTML = buildSignatureHTML(profile, { withPhoto: true });
  previewNoPhoto.innerHTML = buildSignatureHTML(profile, { withPhoto: false });
}

function setPhotoLocked(locked) {
  photoLockedView.hidden = !locked;
  photoFormWrap.hidden = locked;
}

// Copies the fully-rendered HTML (with inline styles) so pasting into the
// Gmail signature box keeps the layout, photo, and colors intact.
async function copyNode(node) {
  // The icon/banner <img> tags use relative src paths so they work whether
  // this app is running on localhost or a deployed domain. Rewriting each
  // attribute to element.src (a browser getter that always resolves to a
  // full absolute URL based on the current page) bakes in the right host
  // at copy time, so the pasted signature keeps working once it leaves
  // this page.
  node.querySelectorAll("img").forEach((img) => {
    img.setAttribute("src", img.src);
  });

  const html = node.innerHTML;
  const text = node.innerText;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch (err) {
    // Fallback for browsers without ClipboardItem support: select the
    // rendered node in the page and use the older execCommand copy.
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const ok = document.execCommand("copy");
    selection.removeAllRanges();
    return ok;
  }
}

requireAuth(async (user) => {
  currentUid = user.uid;
  const { data } = await getOrCreateProfile(user.uid, user.email);
  profile = data;

  if (profile.photoURL) {
    photoPreview.src = profile.photoURL;
    setPhotoLocked(true);
  } else {
    setPhotoLocked(false);
  }

  fontSelect.value = profile.fontFamily || "Inter";
  renderTemplates();

  fontSelect.addEventListener("change", async () => {
    profile = { ...profile, fontFamily: fontSelect.value };
    renderTemplates();
    await backend.updateProfile(currentUid, { fontFamily: fontSelect.value });
  });

  document.getElementById("copy-with-photo").addEventListener("click", async () => {
    const ok = await copyNode(previewWithPhoto);
    copyStatus.textContent = ok
      ? "Copied! Paste it into Gmail: Settings > See all settings > Signature."
      : "Could not copy automatically — select the signature above and copy it manually (Ctrl+C).";
  });

  document.getElementById("copy-no-photo").addEventListener("click", async () => {
    const ok = await copyNode(previewNoPhoto);
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
      photoPreview.src = photoURL;
      setPhotoLocked(true);
      renderTemplates();
      photoSuccess.textContent = "Photo saved.";
    } catch (err) {
      photoError.textContent = err.message.replace("Firebase: ", "");
    }
  });
});
