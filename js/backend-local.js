// Zero-config demo backend. Everything lives in this browser's localStorage
// — no server, no API keys. Good for trying out the UI before you've wired
// up Supabase. NOT shared across devices/browsers — demo use only.
//
// Implements the same shape as backend-supabase.js so pages never know
// which one they're talking to (see backend.js).

const SESSION_KEY = "sign_demo_session";
const PROFILE_KEY = (uid) => `sign_demo_profile_${uid}`;

// The one stand-in account "Continue with Google" logs into in this mode.
// Its email uses an allowed domain on purpose, so the same domain check
// used everywhere else (see app-config.js) doesn't need a special case for
// demo mode.
const DEMO_UID = "demo-user";
const DEMO_EMAIL = "demo@student.gitam.edu";
const DEMO_NAME = "Demo Student";

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
    fontFamily: "Inter",
    detailsSubmitted: false,
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

function currentSessionUser() {
  if (!localStorage.getItem(SESSION_KEY)) return null;
  return { uid: DEMO_UID, email: DEMO_EMAIL, displayName: DEMO_NAME };
}

export const backend = {
  async loginWithGoogle() {
    localStorage.setItem(SESSION_KEY, DEMO_UID);
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
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
    await this.updateProfile(uid, { photoURL: dataUrl });
    return dataUrl;
  },
};
