// Zero-config demo backend. Everything lives in this browser's localStorage
// — no server, no API keys. Good for trying out the UI before you've wired
// up Supabase. NOT shared across devices/browsers — demo use only.
//
// Implements the same shape as backend-supabase.js so pages never know
// which one they're talking to (see backend.js).

import { ADMIN_EMAIL } from "./app-config.js";

const SESSION_KEY = "sign_demo_session";
const SIGNATURES_KEY = "sign_demo_signatures";

const DEMO_UID = "demo-user";
const DEMO_EMAIL = "demo@student.gitam.edu";
const DEMO_NAME = "Demo Student";
const ADMIN_UID = "demo-admin";

function blankSignature(name, isDefault) {
  return {
    name,
    isDefault,
    fullName: "",
    program: "",
    department: "",
    school: "",
    campus: "",
    mobile: "",
    website: "",
    websiteLabel: "",
    photoURL: "",
    linkedin: "",
    instagram: "",
    youtube: "",
    facebook: "",
    twitter: "",
    fontFamily: "Georgia",
    bannerURL: "",
    bannerLink: "",
    detailsSubmitted: false,
  };
}

function readAllSignatures() {
  return JSON.parse(localStorage.getItem(SIGNATURES_KEY) || "{}");
}

function writeAllSignatures(map) {
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(map));
}

// Seed a ready-to-use demo signature for the demo student account the
// first time this ever loads, so there's something to see immediately.
(function seedDemoSignature() {
  const map = readAllSignatures();
  const alreadySeeded = Object.values(map).some((s) => s.ownerId === DEMO_UID);
  if (alreadySeeded) return;

  const id = "demo-signature";
  map[id] = {
    ...blankSignature("GITAM Signature", true),
    ownerId: DEMO_UID,
    fullName: DEMO_NAME,
    program: "B.Tech Computer Science Engineering",
    department: "Computer Science and Engineering",
    school: "School of Technology",
    campus: "Visakhapatnam",
    mobile: "+91 90000 00000",
    website: "https://example.edu",
    linkedin: "https://linkedin.com/in/example",
    detailsSubmitted: true,
    createdAt: Date.now(),
  };
  writeAllSignatures(map);
})();

function readFileAsDataURL(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

function currentSessionUser() {
  const uid = localStorage.getItem(SESSION_KEY);
  if (uid === ADMIN_UID) return { uid: ADMIN_UID, email: ADMIN_EMAIL, displayName: "Admin" };
  if (uid === DEMO_UID) return { uid: DEMO_UID, email: DEMO_EMAIL, displayName: DEMO_NAME };
  return null;
}

function toApp(id, row) {
  const { ownerId, createdAt, ...rest } = row;
  return { id, ...rest };
}

export const backend = {
  async loginWithGoogle() {
    localStorage.setItem(SESSION_KEY, DEMO_UID);
    return currentSessionUser();
  },

  async adminLogin({ email }) {
    if (email !== ADMIN_EMAIL) throw new Error("Invalid email or password.");
    localStorage.setItem(SESSION_KEY, ADMIN_UID);
    return currentSessionUser();
  },

  async logOut() {
    localStorage.removeItem(SESSION_KEY);
  },

  // Mimics Supabase's onAuthStateChange: calls back immediately with
  // whoever is logged in (or null), and returns an unsubscribe function.
  onAuthChange(callback) {
    callback(currentSessionUser());
    return () => {};
  },

  async listSignatures(ownerUid) {
    const map = readAllSignatures();
    return Object.entries(map)
      .filter(([, row]) => row.ownerId === ownerUid)
      .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0))
      .map(([id, row]) => toApp(id, row));
  },

  async getSignature(id) {
    const map = readAllSignatures();
    return map[id] ? toApp(id, map[id]) : null;
  },

  async ensureAtLeastOneSignature(ownerUid) {
    const existing = await this.listSignatures(ownerUid);
    if (existing.length > 0) return existing;
    const created = await this.createSignature(ownerUid, "GITAM Signature", true);
    return [created];
  },

  async createSignature(ownerUid, name, isDefault = false) {
    const id = crypto.randomUUID();
    const map = readAllSignatures();
    map[id] = { ...blankSignature(name, isDefault), ownerId: ownerUid, createdAt: Date.now() };
    writeAllSignatures(map);
    return toApp(id, map[id]);
  },

  async updateSignature(id, updates) {
    const map = readAllSignatures();
    if (!map[id]) throw new Error("Signature not found.");
    map[id] = { ...map[id], ...updates };
    writeAllSignatures(map);
    return updates;
  },

  async deleteSignature(id) {
    const map = readAllSignatures();
    delete map[id];
    writeAllSignatures(map);
  },

  // NOTE: this demo mode stores the photo/banner as a data URL, embedded
  // directly in whatever HTML you copy. That's fine for trying out the UI,
  // but it does NOT demonstrate the "old emails auto-update" trick, since
  // a data URL isn't a live link — it's baked into the copied HTML at copy
  // time. That behavior needs a real backend (Supabase) with a public,
  // stable file URL. See backend-supabase.js.
  // ownerUid is unused here (no real storage paths in demo mode) but kept
  // in the signature to match backend-supabase.js.
  async uploadPhoto(ownerUid, id, fileOrBlob) {
    const dataUrl = await readFileAsDataURL(fileOrBlob);
    await this.updateSignature(id, { photoURL: dataUrl });
    return dataUrl;
  },

  async uploadBanner(ownerUid, id, fileOrBlob) {
    const dataUrl = await readFileAsDataURL(fileOrBlob);
    await this.updateSignature(id, { bannerURL: dataUrl });
    return dataUrl;
  },
};
