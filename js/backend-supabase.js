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
  bannerURL: "banner_url",
  bannerLink: "banner_link",
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

function toAppUser(user) {
  if (!user) return null;
  return { uid: user.id, email: user.email, displayName: user.user_metadata?.full_name || "" };
}

export const backend = {
  // Real password auth for the one admin account — separate from the
  // Google flow students use. Nothing about this checks the GITAM domain
  // restriction; the caller (requireAdmin in auth-guard.js) checks the
  // signed-in email against ADMIN_EMAIL instead.
  async adminLogin({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return toAppUser(data.user);
  },

  // Supabase's OAuth flow is a full-page redirect (not a popup): the
  // browser navigates to Google and back, landing on `redirectTo`. There's
  // nothing meaningful to return here — index.html's own post-redirect
  // page load is what picks the new session up via onAuthChange and routes
  // the user to profile.html or dashboard.html (see auth-guard.js).
  async loginWithGoogle() {
    const redirectTo = new URL("index.html", window.location.href).href;
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

  // A Supabase public bucket's URL for a given path never changes on its
  // own — no token trick needed. Just upload to the same "<uid>/photo.png"
  // path every time (upsert: true) and the URL is permanently stable by
  // construction, which is exactly the "point at a URL, swap the file
  // behind it" mechanism that makes already-sent emails pick up the new
  // photo.
  //
  // cacheControl: "0" is what actually makes that work in practice: without
  // it, Supabase defaults to telling every viewer (your own browser, Gmail's
  // image proxy, anyone) they can treat this URL as unchanged for a full
  // hour, so a fresh upload wouldn't visibly show up anywhere until that
  // cache expired. "0" forces a re-check on every fetch instead — cheap
  // (a 304 if nothing changed) and correct.
  async uploadPhoto(uid, fileOrBlob) {
    const path = `${uid}/photo.png`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || "image/png",
      cacheControl: "0",
    });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await this.updateProfile(uid, { photoURL: publicUrl });
    return publicUrl;
  },

  // ---- Admin-managed signatures ----
  // These aren't tied to any auth.users row at all — the admin creates one
  // per organization/person they're building a signature for, entirely
  // independent of student self-service accounts. Row-level security in
  // supabase-schema.sql restricts this whole table to the admin account.

  async listManagedSignatures() {
    const { data, error } = await supabase
      .from("managed_signatures")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((row) => ({ id: row.id, ...fromDbRow(row) }));
  },

  async getManagedSignature(id) {
    const { data, error } = await supabase.from("managed_signatures").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, ...fromDbRow(data) } : null;
  },

  async createManagedSignature() {
    const id = crypto.randomUUID();
    const blank = blankManagedSignature();
    const { error } = await supabase.from("managed_signatures").insert({ id, ...toDbRow(blank) });
    if (error) throw error;
    return { id, ...blank };
  },

  async saveManagedSignature(id, updates) {
    const { error } = await supabase.from("managed_signatures").update(toDbRow(updates)).eq("id", id);
    if (error) throw error;
    return updates;
  },

  async deleteManagedSignature(id) {
    const { error } = await supabase.from("managed_signatures").delete().eq("id", id);
    if (error) throw error;
  },

  async uploadManagedPhoto(id, fileOrBlob) {
    const path = `managed/${id}/photo.png`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || "image/png",
      cacheControl: "0",
    });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await this.saveManagedSignature(id, { photoURL: publicUrl });
    return publicUrl;
  },

  // No fixed extension in the path — Content-Type metadata (set above via
  // `contentType`) is what tells browsers/email clients how to render it,
  // not the URL. That keeps this URL stable even if the admin re-uploads a
  // banner in a different format later (gif -> png, say).
  async uploadManagedBanner(id, fileOrBlob) {
    const path = `${id}/banner`;
    const { error: uploadError } = await supabase.storage.from("banners").upload(path, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || "image/gif",
      cacheControl: "0",
    });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("banners").getPublicUrl(path);

    await this.saveManagedSignature(id, { bannerURL: publicUrl });
    return publicUrl;
  },
};
