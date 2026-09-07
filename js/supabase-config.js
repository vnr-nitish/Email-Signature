// ============================================================================
// 1. Go to https://supabase.com -> New project (free tier is plenty).
// 2. Project Settings (gear icon) > API -> copy "Project URL" and the
//    "anon public" key (NOT the service_role key — that one must never be
//    used in browser code) into the two values below.
// 3. Authentication > Providers -> Email is on by default. For instant
//    login right after signup during development, turn OFF "Confirm email"
//    (Authentication > Providers > Email > Confirm email). Turn it back on
//    for a real production rollout.
// 4. Authentication > Providers -> enable Google if you want the "Continue
//    with Google" button to work for real (needs a Google Cloud OAuth
//    client ID/secret, which Supabase's UI walks you through).
// 5. SQL Editor -> paste and run supabase-schema.sql (creates the profiles
//    table + its row-level-security policies + the avatars storage bucket
//    policies).
// 6. Storage -> confirm the "avatars" bucket exists and is marked Public
//    (the schema script creates it, but double check) — public read is
//    required since Gmail fetches the photo with no login session at all.
// 7. Set BACKEND = "supabase" in js/app-config.js.
// ============================================================================
export const supabaseConfig = {
  url: "https://nuplchxkgftjzokaucar.supabase.co", 
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cGxjaHhrZ2Z0anpva2F1Y2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODU0MjUsImV4cCI6MjEwNDM2MTQyNX0.RcoMFY__HsqwKuyf6C0VUWAPMpEwEKo4LZeegmQmNJ8",
};
