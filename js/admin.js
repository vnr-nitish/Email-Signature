import { backend } from "./backend.js";
import { requireAdmin, wireLogout } from "./auth-guard.js";
import { buildSignatureHTML, FONT_OPTIONS } from "./signature-template.js";
import { openCropper } from "./photo-cropper.js";
import { copySignatureNode } from "./copy-signature.js";

wireLogout(document.getElementById("logout-btn"));

const listEl = document.getElementById("signature-list");
const newBtn = document.getElementById("new-btn");
const editorCard = document.getElementById("editor-card");
const previewCard = document.getElementById("preview-card");
const editorForm = document.getElementById("editor-form");
const deleteBtn = document.getElementById("delete-btn");
const detailsSuccess = document.getElementById("details-success");
const detailsError = document.getElementById("details-error");

const photoInput = document.getElementById("photo-input");
const photoPreview = document.getElementById("photo-preview");
const bannerInput = document.getElementById("banner-input");
const bannerPreview = document.getElementById("banner-preview");
const bannerLinkInput = document.getElementById("bannerLink");
const saveBannerLinkBtn = document.getElementById("save-banner-link-btn");
const bannerSuccess = document.getElementById("banner-success");
const bannerError = document.getElementById("banner-error");

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

let currentId = null;
let currentSignature = null;
// See dashboard.js for why: appended only to what's displayed/copied, never
// saved, so every render is a literally different URL that no cache layer
// can have a stale matching entry for. Separate values for photo and
// banner since they're uploaded independently.
let photoCacheBust = Date.now();
let bannerCacheBust = Date.now();

function withCacheBust(url, bust) {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${bust}`;
}

function renderTemplates() {
  const displaySignature = {
    ...currentSignature,
    photoURL: withCacheBust(currentSignature.photoURL, photoCacheBust),
    bannerURL: withCacheBust(currentSignature.bannerURL, bannerCacheBust),
  };
  previewWithPhoto.innerHTML = buildSignatureHTML(displaySignature, { withPhoto: true });
  previewNoPhoto.innerHTML = buildSignatureHTML(displaySignature, { withPhoto: false });
}

async function refreshList() {
  const rows = await backend.listManagedSignatures();
  listEl.innerHTML = "";
  if (rows.length === 0) {
    listEl.innerHTML = '<p class="muted">No managed signatures yet.</p>';
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "upload-row";
    item.style.borderBottom = "1px solid var(--border)";
    item.style.padding = "10px 0";
    item.innerHTML = `
      <div style="flex:1;">
        <strong>${row.fullName || "(unnamed)"}</strong>
        <span class="muted">${row.school ? " — " + row.school : ""}</span>
      </div>`;
    const openBtn = document.createElement("button");
    openBtn.className = "btn secondary";
    openBtn.type = "button";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => selectSignature(row.id));
    item.appendChild(openBtn);
    listEl.appendChild(item);
  });
}

function fillEditor(signature) {
  FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el) el.value = signature[key] || "";
  });
  fontSelect.value = signature.fontFamily || "Georgia";
  bannerLinkInput.value = signature.bannerLink || "";

  if (signature.photoURL) {
    photoPreview.src = withCacheBust(signature.photoURL, photoCacheBust);
    photoPreview.hidden = false;
  } else {
    photoPreview.hidden = true;
  }

  if (signature.bannerURL) {
    bannerPreview.src = withCacheBust(signature.bannerURL, bannerCacheBust);
    bannerPreview.hidden = false;
  } else {
    bannerPreview.hidden = true;
  }
}

async function selectSignature(id) {
  currentId = id;
  currentSignature = await backend.getManagedSignature(id);

  fillEditor(currentSignature);
  renderTemplates();
  editorCard.hidden = false;
  previewCard.hidden = false;
  detailsSuccess.textContent = "";
  detailsError.textContent = "";
  bannerSuccess.textContent = "";
  bannerError.textContent = "";
  editorCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

requireAdmin(async () => {
  await refreshList();

  newBtn.addEventListener("click", async () => {
    const created = await backend.createManagedSignature();
    await refreshList();
    await selectSignature(created.id);
  });

  fontSelect.addEventListener("change", async () => {
    currentSignature = { ...currentSignature, fontFamily: fontSelect.value };
    renderTemplates();
    await backend.saveManagedSignature(currentId, { fontFamily: fontSelect.value });
  });

  editorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    detailsSuccess.textContent = "";
    detailsError.textContent = "";

    const updates = {};
    FIELDS.forEach((key) => {
      updates[key] = document.getElementById(key).value.trim();
    });

    try {
      await backend.saveManagedSignature(currentId, updates);
      currentSignature = { ...currentSignature, ...updates };
      renderTemplates();
      await refreshList();
      detailsSuccess.textContent = "Saved.";
    } catch (err) {
      detailsError.textContent = err.message;
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!currentId) return;
    if (!confirm("Delete this signature? This can't be undone.")) return;
    await backend.deleteManagedSignature(currentId);
    currentId = null;
    currentSignature = null;
    editorCard.hidden = true;
    previewCard.hidden = true;
    await refreshList();
  });

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    const cropped = await openCropper(file);
    photoInput.value = "";
    if (!cropped) return;

    detailsSuccess.textContent = "";
    detailsError.textContent = "";
    try {
      const photoURL = await backend.uploadManagedPhoto(currentId, cropped);
      currentSignature = { ...currentSignature, photoURL };
      photoCacheBust = Date.now();
      photoPreview.src = withCacheBust(photoURL, photoCacheBust);
      photoPreview.hidden = false;
      renderTemplates();
      detailsSuccess.textContent = "Photo saved.";
    } catch (err) {
      detailsError.textContent = err.message;
    }
  });

  bannerInput.addEventListener("change", async () => {
    const file = bannerInput.files[0];
    if (!file) return;
    bannerInput.value = "";

    bannerSuccess.textContent = "";
    bannerError.textContent = "";
    try {
      const bannerURL = await backend.uploadManagedBanner(currentId, file);
      currentSignature = { ...currentSignature, bannerURL };
      bannerCacheBust = Date.now();
      bannerPreview.src = withCacheBust(bannerURL, bannerCacheBust);
      bannerPreview.hidden = false;
      renderTemplates();
      bannerSuccess.textContent = "Banner saved.";
    } catch (err) {
      bannerError.textContent = err.message;
    }
  });

  saveBannerLinkBtn.addEventListener("click", async () => {
    bannerSuccess.textContent = "";
    bannerError.textContent = "";
    try {
      const bannerLink = bannerLinkInput.value.trim();
      await backend.saveManagedSignature(currentId, { bannerLink });
      currentSignature = { ...currentSignature, bannerLink };
      renderTemplates();
      bannerSuccess.textContent = "Banner link saved.";
    } catch (err) {
      bannerError.textContent = err.message;
    }
  });

  document.getElementById("copy-with-photo").addEventListener("click", async () => {
    const ok = await copySignatureNode(previewWithPhoto);
    copyStatus.textContent = ok
      ? "Copied! Paste it wherever this signature is needed."
      : "Could not copy automatically — select the signature above and copy it manually (Ctrl+C).";
  });

  document.getElementById("copy-no-photo").addEventListener("click", async () => {
    const ok = await copySignatureNode(previewNoPhoto);
    copyStatus.textContent = ok
      ? "Copied! Paste it wherever this signature is needed."
      : "Could not copy automatically — select the signature above and copy it manually (Ctrl+C).";
  });
});
