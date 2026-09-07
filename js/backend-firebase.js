import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile as updateAuthProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { auth, db, storage } from "./firebase-init.js";

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
    photoToken: "",
    linkedin: "",
    instagram: "",
    youtube: "",
    facebook: "",
    twitter: "",
    fontFamily: "Inter",
    detailsSubmitted: false,
    createdAt: serverTimestamp(),
  };
}

async function ensureProfileDoc(uid, email, fullName) {
  const ref = doc(db, "profiles", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, blankProfile(email, fullName));
  }
}

export const backend = {
  async signUp({ name, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateAuthProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "profiles", cred.user.uid), blankProfile(email, name));
    return { uid: cred.user.uid, email, displayName: name };
  },

  async logIn({ email, password }) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { uid: cred.user.uid, email: cred.user.email, displayName: cred.user.displayName };
  },

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    await ensureProfileDoc(cred.user.uid, cred.user.email, cred.user.displayName || "");
    return { uid: cred.user.uid, email: cred.user.email, displayName: cred.user.displayName };
  },

  async logOut() {
    await signOut(auth);
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => {
      callback(user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null);
    });
  },

  async getProfile(uid, email) {
    const ref = doc(db, "profiles", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    const profile = blankProfile(email, "");
    await setDoc(ref, profile);
    return profile;
  },

  async updateProfile(uid, updates) {
    await updateDoc(doc(db, "profiles", uid), updates);
    return updates;
  },

  // A fixed download token is generated once per user and reused on every
  // re-upload, so the photo URL never changes. That's what makes every
  // signature (including ones already sent by email) auto-update to the
  // new photo: the client just refetches this same URL each time the
  // message is opened.
  async uploadPhoto(uid, fileOrBlob) {
    const profile = await this.getProfile(uid);
    const token = profile.photoToken || crypto.randomUUID();

    const ref = storageRef(storage, `photos/${uid}`);
    await uploadBytes(ref, fileOrBlob, {
      contentType: fileOrBlob.type || "image/png",
      customMetadata: { firebaseStorageDownloadTokens: token },
    });
    const photoURL = await getDownloadURL(ref);

    await this.updateProfile(uid, { photoURL, photoToken: token });
    return photoURL;
  },
};
