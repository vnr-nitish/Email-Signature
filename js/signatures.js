import { backend } from "./backend.js";
import { requireSignatureAccess, wireLogout } from "./auth-guard.js";
import { buildSignatureHTML, FONT_OPTIONS, DEFAULT_ICON_COLOR } from "./signature-template.js";
import { openCropper } from "./photo-cropper.js";
import { copySignatureNode } from "./copy-signature.js";
import { getIconUrls } from "./icon-recolor.js";

wireLogout(document.getElementById("logout-btn"));

// program/department/school/campus are the same four columns for every
// signature — only the labels shown to the user change depending on
// whether this is the default GITAM signature or a custom one for
// somewhere else.
const LABELS = {
  default: {
    program: "Program (with course)",
    department: "Department",
    school: "School",
    campus: "Campus",
  },
  custom: {
    program: "Position / Designation / Role",
    department: "Wing / Branch",
    school: "Institute / Organization",
    campus: "Location",
  },
};

const HINTS = {
  default:
    "These appear on every signature template, in this order: name, program, department, school, campus, mobile, website.",
  custom:
    "These appear on this signature, in this order: name, position/designation, wing/branch, institute/organization, location, mobile, website.",
};

const FIELDS = [
  "fullName",
  "program",
  "department",
  "school",
  "campus",
  "mobile",
  "website",
  "websiteLabel",
  "linkedin",
  "instagram",
  "youtube",
  "facebook",
  "twitter",
];

// Matches assets/banner.gif's own proportions (912x212), so a custom
// banner ends up sized consistently with the default one once it's scaled
// to the signature's fixed width.
const BANNER_ASPECT_RATIO = 912 / 212;

// A plain generic silhouette, not a real photo — avoids needing an actual
// person's likeness (rights/consent issues) just to illustrate where a
// photo goes. Built inline so the example view needs no extra asset file.
const PLACEHOLDER_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r="65" fill="#cbd5d1"/>
      <circle cx="65" cy="52" r="24" fill="#eef3f2"/>
      <path d="M65 84c-26 0-46 15-46 34v12h92v-12c0-19-20-34-46-34z" fill="#eef3f2"/>
    </svg>`
  );

// Sample data for the "See an example" view — not a real signature, never
// saved anywhere, purely illustrative.
const SAMPLE_SIGNATURE = {
  isDefault: false,
  fullName: "Jordan Lee",
  program: "Marketing Manager",
  department: "Digital Marketing Wing",
  school: "Bright Ideas Studio",
  campus: "Bengaluru, India",
  mobile: "+91 90000 00000",
  website: "https://example.com",
  websiteLabel: "",
  photoURL: PLACEHOLDER_AVATAR,
  linkedin: "https://linkedin.com/in/example",
  instagram: "",
  youtube: "",
  facebook: "https://facebook.com/example",
  twitter: "",
  fontFamily: "Georgia",
  bannerURL: "",
  bannerLink: "",
  iconColor: DEFAULT_ICON_COLOR,
};

const sidebarListEl = document.getElementById("sidebar-list");
const newSignatureBtn = document.getElementById("new-signature-btn");
const exampleBtn = document.getElementById("example-btn");
const exampleView = document.getElementById("example-view");
const examplePreviewWithPhoto = document.getElementById("example-preview-with-photo");
const examplePreviewNoPhoto = document.getElementById("example-preview-no-photo");
const tabsBar = document.getElementById("tabs-bar");
const tabDetails = document.getElementById("tab-details");
const tabSignature = document.getElementById("tab-signature");

const detailsHint = document.getElementById("details-hint");
const fieldset = document.getElementById("fieldset");
const detailsForm = document.getElementById("details-form");
const saveBtn = document.getElementById("save-btn");
const editBtn = document.getElementById("edit-btn");
const deleteBtn = document.getElementById("delete-btn");
const frozenNote = document.getElementById("frozen-note");
const detailsSuccess = document.getElementById("details-success");
const detailsError = document.getElementById("details-error");

const photoFormWrap = document.getElementById("photo-form");
const photoInput = document.getElementById("photo");
const photoLockedView = document.getElementById("photo-locked-view");
const photoPreview = document.getElementById("photo-preview");
const changePhotoBtn = document.getElementById("change-photo-btn");
const photoSuccess = document.getElementById("photo-success");
const photoError = document.getElementById("photo-error");

const bannerCard = document.getElementById("banner-card");
const bannerInput = document.getElementById("banner-input");
const bannerPreview = document.getElementById("banner-preview");
const bannerLinkInput = document.getElementById("bannerLink");
const saveBannerLinkBtn = document.getElementById("save-banner-link-btn");
const bannerSuccess = document.getElementById("banner-success");
const bannerError = document.getElementById("banner-error");

const iconColorCard = document.getElementById("icon-color-card");
const iconColorInput = document.getElementById("icon-color");

const fontSelect = document.getElementById("font-select");
const previewWithPhoto = document.getElementById("preview-with-photo");
const previewNoPhoto = document.getElementById("preview-no-photo");
const copyStatus = document.getElementById("copy-status");

Object.keys(FONT_OPTIONS).forEach((name) => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  fontSelect.appendChild(option);
});

let currentUid = null;
let signatures = [];
let currentId = null;
let currentSignature = null;
let activeTab = "details";
// See dashboard.js's original note: appended only to what's displayed or
// copied, never persisted, so every render is a different URL that no
// cache anywhere can have a stale matching entry for.
let photoCacheBust = Date.now();
let bannerCacheBust = Date.now();

function withCacheBust(url, bust) {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${bust}`;
}

function setLocked(locked) {
  fieldset.disabled = locked;
  saveBtn.hidden = locked;
  editBtn.hidden = !locked;
  frozenNote.hidden = !locked;
}

function setPhotoLocked(locked) {
  photoLockedView.hidden = !locked;
  photoFormWrap.hidden = locked;
}

function renderSidebar() {
  sidebarListEl.innerHTML = "";
  signatures.forEach((sig) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sig-sidebar-item" + (sig.id === currentId ? " active" : "");
    btn.textContent = sig.name || "Untitled Signature";
    btn.addEventListener("click", () => selectSignature(sig.id));
    sidebarListEl.appendChild(btn);
  });
}

function switchTab(tab) {
  activeTab = tab;
  tabDetails.hidden = tab !== "details";
  tabSignature.hidden = tab !== "signature";
  document.querySelectorAll(".sig-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
}

document.querySelectorAll(".sig-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function fillDetailsForm(sig) {
  const labelSet = sig.isDefault ? LABELS.default : LABELS.custom;
  document.getElementById("label-program").textContent = labelSet.program;
  document.getElementById("label-department").textContent = labelSet.department;
  document.getElementById("label-school").textContent = labelSet.school;
  document.getElementById("label-campus").textContent = labelSet.campus;
  detailsHint.textContent = sig.isDefault ? HINTS.default : HINTS.custom;

  FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el) el.value = sig[key] || "";
  });
  setLocked(Boolean(sig.detailsSubmitted));
  detailsSuccess.textContent = "";
  detailsError.textContent = "";
}

function fillPhotoBanner(sig) {
  if (sig.photoURL) {
    photoPreview.src = withCacheBust(sig.photoURL, photoCacheBust);
    setPhotoLocked(true);
  } else {
    photoPreview.removeAttribute("src");
    setPhotoLocked(false);
  }

  bannerCard.hidden = sig.isDefault;
  if (!sig.isDefault) {
    bannerLinkInput.value = sig.bannerLink || "";
    if (sig.bannerURL) {
      bannerPreview.src = withCacheBust(sig.bannerURL, bannerCacheBust);
      bannerPreview.hidden = false;
    } else {
      bannerPreview.removeAttribute("src");
      bannerPreview.hidden = true;
    }
  }

  iconColorCard.hidden = sig.isDefault;
  iconColorInput.value = sig.iconColor || DEFAULT_ICON_COLOR;

  fontSelect.value = sig.fontFamily || "Georgia";
  photoSuccess.textContent = "";
  photoError.textContent = "";
  bannerSuccess.textContent = "";
  bannerError.textContent = "";
}

async function renderTemplates() {
  const renderingId = currentId; // guards against a slower, older call
  // overwriting a newer one after switching signatures mid-recolor.
  const iconUrls = currentSignature.isDefault ? null : await getIconUrls(currentSignature.iconColor);
  if (renderingId !== currentId) return;

  const displaySignature = {
    ...currentSignature,
    photoURL: withCacheBust(currentSignature.photoURL, photoCacheBust),
    bannerURL: withCacheBust(currentSignature.bannerURL, bannerCacheBust),
    iconUrls,
  };
  previewWithPhoto.innerHTML = buildSignatureHTML(displaySignature, { withPhoto: true });
  previewNoPhoto.innerHTML = buildSignatureHTML(displaySignature, { withPhoto: false });
}

// "example" - the permanent, always-available sample (shown automatically
// when there are zero real signatures, or any time via the sidebar button).
// "editor" - the real Details/Signature tabs for the selected signature.
function setMainView(view) {
  exampleView.hidden = view !== "example";
  const showEditor = view === "editor";
  tabsBar.hidden = !showEditor;
  tabDetails.hidden = !showEditor || activeTab !== "details";
  tabSignature.hidden = !showEditor || activeTab !== "signature";
}

function renderExample() {
  examplePreviewWithPhoto.innerHTML = buildSignatureHTML(SAMPLE_SIGNATURE, { withPhoto: true });
  examplePreviewNoPhoto.innerHTML = buildSignatureHTML(SAMPLE_SIGNATURE, { withPhoto: false });
}

async function refreshSignatures() {
  signatures = await backend.listSignatures(currentUid);
  renderSidebar();
}

async function selectSignature(id) {
  currentId = id;
  currentSignature = await backend.getSignature(id);
  photoCacheBust = Date.now();
  bannerCacheBust = Date.now();

  renderSidebar();
  setMainView("editor");
  fillDetailsForm(currentSignature);
  fillPhotoBanner(currentSignature);
  renderTemplates();
}

requireSignatureAccess(async (user) => {
  currentUid = user.uid;
  signatures = await backend.listSignatures(currentUid);
  renderSidebar();
  renderExample();

  if (signatures.length > 0) {
    await selectSignature(signatures[0].id);
  } else {
    setMainView("example");
  }

  exampleBtn.addEventListener("click", () => setMainView("example"));

  newSignatureBtn.addEventListener("click", async () => {
    const name = prompt("Name this signature (e.g. your other company or organization):");
    if (!name || !name.trim()) return;
    const created = await backend.createSignature(currentUid, name.trim(), false);
    await refreshSignatures();
    await selectSignature(created.id);
    switchTab("details");
  });

  detailsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    detailsSuccess.textContent = "";
    detailsError.textContent = "";

    const updates = { detailsSubmitted: true };
    FIELDS.forEach((key) => {
      updates[key] = document.getElementById(key).value.trim();
    });

    try {
      await backend.updateSignature(currentId, updates);
      currentSignature = { ...currentSignature, ...updates };
      setLocked(true);
      renderTemplates();
      await refreshSignatures();
      detailsSuccess.textContent = 'Saved. Click "Edit Details" any time to change these.';
    } catch (err) {
      detailsError.textContent = err.message;
    }
  });

  editBtn.addEventListener("click", () => {
    setLocked(false);
    detailsSuccess.textContent = "";
  });

  deleteBtn.addEventListener("click", async () => {
    if (!currentId) return;
    if (!confirm(`Delete "${currentSignature.name}"? This can't be undone.`)) return;
    await backend.deleteSignature(currentId);
    currentId = null;
    currentSignature = null;
    await refreshSignatures();
    if (signatures.length > 0) {
      await selectSignature(signatures[0].id);
    } else {
      setMainView("example");
    }
  });

  fontSelect.addEventListener("change", async () => {
    currentSignature = { ...currentSignature, fontFamily: fontSelect.value };
    renderTemplates();
    await backend.updateSignature(currentId, { fontFamily: fontSelect.value });
  });

  iconColorInput.addEventListener("change", async () => {
    currentSignature = { ...currentSignature, iconColor: iconColorInput.value };
    renderTemplates();
    await backend.updateSignature(currentId, { iconColor: iconColorInput.value });
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
      const photoURL = await backend.uploadPhoto(currentUid, currentId, cropped);
      currentSignature = { ...currentSignature, photoURL };
      photoCacheBust = Date.now();
      photoPreview.src = withCacheBust(photoURL, photoCacheBust);
      setPhotoLocked(true);
      renderTemplates();
      photoSuccess.textContent = "Photo saved.";
    } catch (err) {
      photoError.textContent = err.message;
    }
  });

  bannerInput.addEventListener("change", async () => {
    const file = bannerInput.files[0];
    if (!file) return;

    // The crop tool works by drawing onto a canvas, which can only ever
    // hold one static frame — running a GIF through it would silently
    // flatten away its animation. So GIFs skip cropping entirely and
    // upload exactly as given (animation intact); anything else (PNG/JPG,
    // which was never going to animate anyway) gets cropped/zoomed to fit.
    const isGif = file.type === "image/gif";
    const toUpload = isGif
      ? file
      : await openCropper(file, { shape: "rect", aspectRatio: BANNER_ASPECT_RATIO, outputWidth: 940 });
    bannerInput.value = "";
    if (!toUpload) return; // user cancelled the cropper

    bannerSuccess.textContent = "";
    bannerError.textContent = "";
    try {
      const bannerURL = await backend.uploadBanner(currentUid, currentId, toUpload);
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

    const bannerLink = bannerLinkInput.value.trim();
    if (!bannerLink) {
      bannerError.textContent = "Enter a link first - nothing was saved.";
      return;
    }

    try {
      await backend.updateSignature(currentId, { bannerLink });
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
      ? "Copied! Paste it into Gmail: Settings > See all settings > Signature."
      : "Could not copy automatically - select the signature above and copy it manually (Ctrl+C).";
  });

  document.getElementById("copy-no-photo").addEventListener("click", async () => {
    const ok = await copySignatureNode(previewNoPhoto);
    copyStatus.textContent = ok
      ? "Copied! Paste it into Gmail: Settings > See all settings > Signature."
      : "Could not copy automatically - select the signature above and copy it manually (Ctrl+C).";
  });
});
