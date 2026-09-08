import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseConfig } from "./supabase-config.js";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

// The app's signature object uses camelCase everywhere; Postgres/Supabase
// convention is snake_case columns. This map is the single place that
// translates between the two, so the rest of the app never needs to know
// the DB's naming convention.
const FIELD_MAP = {
  name: "name",
  isDefault: "is_default",
  fullName: "full_name",
  program: "program",
  department: "department",
  school: "school",
  campus: "campus",
  mobile: "mobile",
  website: "website",
  websiteLabel: "website_label",
  photoURL: "photo_url",
  linkedin: "linkedin",
  instagram: "instagram",
  youtube: "youtube",
  facebook: "facebook",
  twitter: "twitter",
  fontFamily: "font_family",
  bannerURL: "banner_url",
  bannerLink: "banner_link",
  detailsSubmitted: "details_submitted",
};

function toDbRow(partial) {
  const row = {};
  for (const [appKey, dbKey] of Object.entries(FIELD_MAP)) {
    if (appKey in partial) row[dbKey] = partial[appKey];
  }
  return row;
}

function fromDbRow(row) {
  const sig = { id: row.id };
  for (const [appKey, dbKey] of Object.entries(FIELD_MAP)) {
    sig[appKey] = row[dbKey];
  }
  return sig;
}

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

function toAppUser(user) {
  if (!user) return null;
  return { uid: user.id, email: user.email, displayName: user.user_metadata?.full_name || "" };
}

export const backend = {
  // Real password auth for the one admin account — separate from the
  // Google flow students use. Nothing about this checks the GITAM domain
  // restriction; the signature ownership policy allows the admin account
  // in independently (see is_admin() in the schema).
  async adminLogin({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return toAppUser(data.user);
  },

  // Supabase's OAuth flow is a full-page redirect (not a popup): the
  // browser navigates to Google and back, landing on `redirectTo`. There's
  // nothing meaningful to return here — index.html's own post-redirect
  // page load is what picks the new session up via onAuthChange.
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

  async listSignatures(ownerUid) {
    const { data, error } = await supabase
      .from("signatures")
      .select("*")
      .eq("owner_id", ownerUid)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(fromDbRow);
  },

  async getSignature(id) {
    const { data, error } = await supabase.from("signatures").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromDbRow(data) : null;
  },

  // Called right after a real GITAM Google login. If this account has no
  // signatures at all yet, seeds one default "GITAM Signature" — but only
  // once ever per empty state, so deleting it later doesn't force it back
  // unless they're down to zero signatures again.
  async ensureAtLeastOneSignature(ownerUid) {
    const existing = await this.listSignatures(ownerUid);
    if (existing.length > 0) return existing;
    const created = await this.createSignature(ownerUid, "GITAM Signature", true);
    return [created];
  },

  async createSignature(ownerUid, name, isDefault = false) {
    const blank = blankSignature(name, isDefault);
    const { data, error } = await supabase
      .from("signatures")
      .insert({ owner_id: ownerUid, ...toDbRow(blank) })
      .select()
      .single();
    if (error) throw error;
    return fromDbRow(data);
  },

  async updateSignature(id, updates) {
    const { error } = await supabase.from("signatures").update(toDbRow(updates)).eq("id", id);
    if (error) throw error;
    return updates;
  },

  async deleteSignature(id) {
    const { error } = await supabase.from("signatures").delete().eq("id", id);
    if (error) throw error;
  },

  // A Supabase public bucket's URL for a given path never changes on its
  // own — no token trick needed. Just upload to the same "<id>/photo.png"
  // path every time (upsert: true) and the URL is permanently stable by
  // construction, which is exactly the "point at a URL, swap the file
  // behind it" mechanism that makes already-sent emails pick up the new
  // photo. cacheControl:"0" plus the app's own render-time cache-busting
  // (see signatures.js) are what make that visible promptly in practice.
  async uploadPhoto(id, fileOrBlob) {
    const path = `${id}/photo.png`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || "image/png",
      cacheControl: "0",
    });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await this.updateSignature(id, { photoURL: publicUrl });
    return publicUrl;
  },

  // No fixed extension in the path — Content-Type metadata (set above via
  // `contentType`) is what tells browsers/email clients how to render it,
  // not the URL. That keeps this URL stable even if a different format is
  // uploaded later (gif -> png, say).
  async uploadBanner(id, fileOrBlob) {
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

    await this.updateSignature(id, { bannerURL: publicUrl });
    return publicUrl;
  },
};
