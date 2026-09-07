import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseConfig } from "./supabase-config.js";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

// The app's profile object uses camelCase everywhere (see the other
// backend adapters); Postgres/Supabase convention is snake_case columns.
// This map is the single place that translates between the two, so the
// rest of the app never needs to know which convention the DB uses.
const FIELD_MAP = {
  email: "email",
  fullName: "full_name",
  program: "program",
  department: "department",
  school: "school",
  campus: "campus",
  mobile: "mobile",
  website: "website",
  photoURL: "photo_url",
  linkedin: "linkedin",
  instagram: "instagram",
  youtube: "youtube",
  facebook: "facebook",
  twitter: "twitter",
  fontFamily: "font_family",
  detailsSubmitted: "details_submitted",
};

function toDbRow(partialProfile) {
  const row = {};
  for (const [appKey, dbKey] of Object.entries(FIELD_MAP)) {
    if (appKey in partialProfile) row[dbKey] = partialProfile[appKey];
  }
  return row;
}

function fromDbRow(row) {
  const profile = {};
  for (const [appKey, dbKey] of Object.entries(FIELD_MAP)) {
    profile[appKey] = row[dbKey];
  }
  return profile;
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
    fontFamily: "Inter",
    detailsSubmitted: false,
  };
}

function toAppUser(user) {
  if (!user) return null;
  return { uid: user.id, email: user.email, displayName: user.user_metadata?.full_name || "" };
}

export const backend = {
  async signUp({ name, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: data.user.id, ...toDbRow(blankProfile(email, name)) });
      if (profileError) throw profileError;
    }

    // If your Supabase project has "Confirm email" turned on (the
    // default), signUp doesn't create a session — the student has to
    // click the emailed link first, then log in normally.
    if (!data.session) {
      throw new Error("Account created — check your email to confirm it, then log in.");
    }

    return toAppUser(data.user);
  },

  async logIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return toAppUser(data.user);
  },

  // Supabase's OAuth flow is a full-page redirect (not a popup): the
  // browser navigates to Google and back, landing on `redirectTo`. There's
  // nothing meaningful to return here — the caller's own post-redirect
  // page load is what picks the new session up via onAuthChange.
  async loginWithGoogle() {
    const redirectTo = new URL("dashboard.html", window.location.href).href;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  },

  async logOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthChange(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(toAppUser(session?.user));
    });
    return () => subscription.unsubscribe();
  },

  async getProfile(uid, email) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (error) throw error;
    if (data) return fromDbRow(data);

    const blank = blankProfile(email, "");
    const { error: insertError } = await supabase.from("profiles").insert({ id: uid, ...toDbRow(blank) });
    if (insertError) throw insertError;
    return blank;
  },

  async updateProfile(uid, updates) {
    const { error } = await supabase.from("profiles").update(toDbRow(updates)).eq("id", uid);
    if (error) throw error;
    return updates;
  },

  // Unlike Firebase Storage, a Supabase public bucket's URL for a given
  // path never changes on its own — no manual token trick needed. Just
  // upload to the same "<uid>/photo.png" path every time (upsert: true)
  // and the URL is permanently stable by construction, which is exactly
  // the "point at a URL, swap the file behind it" mechanism that makes
  // already-sent emails pick up the new photo.
  async uploadPhoto(uid, fileOrBlob) {
    const path = `${uid}/photo.png`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || "image/png",
    });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await this.updateProfile(uid, { photoURL: publicUrl });
    return publicUrl;
  },
};
