// Zero-config demo backend. Everything lives in this browser's localStorage
// — no server, no API keys. Good for trying out the UI before you've wired
// up Firebase/Supabase. NOT secure (passwords are stored in plain text) and
// NOT shared across devices/browsers — demo use only.
//
// Implements the same shape as backend-firebase.js so pages never know
// which one they're talking to (see backend.js).

const USERS_KEY = "sign_demo_users";
const SESSION_KEY = "sign_demo_session";
const PROFILE_KEY = (uid) => `sign_demo_profile_${uid}`;

function readUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

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
    detailsSubmitted: false,
  };
}

// Seed a ready-to-use demo account the first time this ever loads, so
// there's something to log in with immediately.
(function seedDemoAccount() {
  const users = readUsers();
  if (users["demo@signdemo.local"]) return;

  const uid = "demo-user";
  users["demo@signdemo.local"] = {
    uid,
    email: "demo@signdemo.local",
    password: "demo1234",
    name: "Demo Student",
  };
  writeUsers(users);

  const profile = blankProfile("demo@signdemo.local", "Demo Student");
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
  localStorage.setItem(PROFILE_KEY(uid), JSON.stringify(profile));
})();

function currentSessionUser() {
  const uid = localStorage.getItem(SESSION_KEY);
  if (!uid) return null;
  const users = readUsers();
  const match = Object.values(users).find((u) => u.uid === uid);
  if (!match) return null;
  return { uid: match.uid, email: match.email, displayName: match.name };
}

function loginUser(uid, email, name) {
  localStorage.setItem(SESSION_KEY, uid);
  return { uid, email, displayName: name };
}

export const backend = {
  async signUp({ name, email, password }) {
    const users = readUsers();
    if (users[email]) {
      throw new Error("An account with this email already exists.");
    }
    const uid = crypto.randomUUID();
    users[email] = { uid, email, password, name };
    writeUsers(users);
    localStorage.setItem(PROFILE_KEY(uid), JSON.stringify(blankProfile(email, name)));
    return loginUser(uid, email, name);
  },

  async logIn({ email, password }) {
    const users = readUsers();
    const user = users[email];
    if (!user || user.password !== password) {
      throw new Error("Invalid email or password.");
    }
    return loginUser(user.uid, user.email, user.name);
  },

  // There's no real Google Sign-In without a Google Cloud project, so this
  // demo mode simulates it with a fixed stand-in account, purely so the
  // "Continue with Google" button has something to demonstrate in the UI.
  // The real flow lives in backend-firebase.js.
  async loginWithGoogle() {
    const users = readUsers();
    const email = "google-demo@signdemo.local";
    if (!users[email]) {
      const uid = crypto.randomUUID();
      users[email] = { uid, email, password: null, name: "Google Demo User" };
      writeUsers(users);
      localStorage.setItem(PROFILE_KEY(uid), JSON.stringify(blankProfile(email, "Google Demo User")));
    }
    const user = users[email];
    return loginUser(user.uid, user.email, user.name);
  },

  async logOut() {
    localStorage.removeItem(SESSION_KEY);
  },

  // Mimics Firebase's onAuthStateChanged: calls back immediately with
  // whoever is logged in (or null), and returns an unsubscribe function.
  onAuthChange(callback) {
    callback(currentSessionUser());
    return () => {};
  },

  async getProfile(uid) {
    const raw = localStorage.getItem(PROFILE_KEY(uid));
    if (raw) return JSON.parse(raw);
    const user = currentSessionUser();
    const profile = blankProfile(user?.email || "", user?.displayName || "");
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
  // That behavior needs a real backend (Firebase/Supabase) with a public,
  // stable file URL. See backend-firebase.js.
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
