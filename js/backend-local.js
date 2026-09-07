// Zero-config demo backend. Everything lives in this browser's localStorage
// — no server, no API keys. Good for trying out the UI before you've wired
// up Supabase. NOT shared across devices/browsers — demo use only.
//
// Implements the same shape as backend-supabase.js so pages never know
// which one they're talking to (see backend.js).

import { ADMIN_EMAIL } from "./app-config.js";

const SESSION_KEY = "sign_demo_session";
const PROFILE_KEY = (uid) => `sign_demo_profile_${uid}`;
const MANAGED_KEY = "sign_demo_managed_signatures";

// The one stand-in account "Continue with Google" logs into in this mode.
// Its email uses an allowed domain on purpose, so the same domain check
// used everywhere else (see app-config.js) doesn't need a special case for
// demo mode.
const DEMO_UID = "demo-user";
const DEMO_EMAIL = "demo@student.gitam.edu";
const DEMO_NAME = "Demo Student";

// The admin's session in this mode is just "signed in as ADMIN_EMAIL" —
// there's no real password to check locally (no server to check it
// against), so adminLogin() below accepts any password for that one email.
// That's fine for demo mode; the real check happens in Supabase.
const ADMIN_UID = "demo-admin";

function blankProfile(email, fullName) {
  return {
    email,
    fullName,
    program: "",
    department: "",
    school: "",
    campus: "",
    mobile: "",
    website: "",
    photoURL: "",
    linkedin: "",
    instagram: "",
    youtube: "",
    facebook: "",
    twitter: "",
    fontFamily: "Georgia",
    detailsSubmitted: false,
  };
}

function blankManagedSignature() {
  return {
    fullName: "",
    program: "",
    department: "",
    school: "",
    campus: "",
    mobile: "",
    website: "",
    photoURL: "",
    linkedin: "",
    instagram: "",
    youtube: "",
    facebook: "",
    twitter: "",
    fontFamily: "Georgia",
    bannerURL: "",
    bannerLink: "",
  };
}

// Seed a ready-to-use demo profile the first time this ever loads, so
// there's something to see immediately after "logging in".
(function seedDemoProfile() {
  if (localStorage.getItem(PROFILE_KEY(DEMO_UID))) return;
  const profile = blankProfile(DEMO_EMAIL, DEMO_NAME);
  Object.assign(profile, {
    program: "B.Tech Computer Science Engineering",
    department: "Computer Science and Engineering",
    school: "School of Technology",
    campus: "Visakhapatnam",
    mobile: "+91 90000 00000",
    website: "https://example.edu",
    linkedin: "https://linkedin.com/in/example",
    detailsSubmitted: true,
  });
  localStorage.setItem(PROFILE_KEY(DEMO_UID), JSON.stringify(profile));
})();

function readManagedMap() {
  return JSON.parse(localStorage.getItem(MANAGED_KEY) || "{}");
}

function writeManagedMap(map) {
  localStorage.setItem(MANAGED_KEY, JSON.stringify(map));
}

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

  async getProfile(uid) {
    const raw = localStorage.getItem(PROFILE_KEY(uid));
    if (raw) return JSON.parse(raw);
    const profile = blankProfile(DEMO_EMAIL, DEMO_NAME);
    localStorage.setItem(PROFILE_KEY(uid), JSON.stringify(profile));
    return profile;
  },

  async updateProfile(uid, updates) {
    const profile = await this.getProfile(uid);
    const merged = { ...profile, ...updates };
    localStorage.setItem(PROFILE_KEY(uid), JSON.stringify(merged));
    return merged;
  },

  // NOTE: this demo mode stores the photo as a data URL, embedded directly
  // in whatever HTML you copy. That's fine for trying out the UI, but it
  // does NOT demonstrate the "old emails auto-update" trick, since a data
  // URL isn't a live link — it's baked into the copied HTML at copy time.
  // That behavior needs a real backend (Supabase) with a public, stable
  // file URL. See backend-supabase.js.
  async uploadPhoto(uid, fileOrBlob) {
    const dataUrl = await readFileAsDataURL(fileOrBlob);
    await this.updateProfile(uid, { photoURL: dataUrl });
    return dataUrl;
  },

  // ---- Admin-managed signatures (demo storage; see backend-supabase.js
  // for the real, database-backed version) ----

  async listManagedSignatures() {
    const map = readManagedMap();
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async getManagedSignature(id) {
    const map = readManagedMap();
    return map[id] ? { id, ...map[id] } : null;
  },

  async createManagedSignature() {
    const id = crypto.randomUUID();
    const map = readManagedMap();
    map[id] = { ...blankManagedSignature(), createdAt: Date.now() };
    writeManagedMap(map);
    return { id, ...map[id] };
  },

  async saveManagedSignature(id, updates) {
    const map = readManagedMap();
    map[id] = { ...(map[id] || blankManagedSignature()), ...updates };
    writeManagedMap(map);
    return map[id];
  },

  async deleteManagedSignature(id) {
    const map = readManagedMap();
    delete map[id];
    writeManagedMap(map);
  },

  async uploadManagedPhoto(id, fileOrBlob) {
    const dataUrl = await readFileAsDataURL(fileOrBlob);
    await this.saveManagedSignature(id, { photoURL: dataUrl });
    return dataUrl;
  },

  async uploadManagedBanner(id, fileOrBlob) {
    const dataUrl = await readFileAsDataURL(fileOrBlob);
    await this.saveManagedSignature(id, { bannerURL: dataUrl });
    return dataUrl;
  },
};
