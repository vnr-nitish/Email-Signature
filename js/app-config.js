// Which backend adapter to use. Every page talks to "./backend.js", which
// just re-exports whichever of these is selected here — so switching
// backends later means changing this one line, not touching any page's
// HTML/JS.
//
//   "local"    - runs entirely in the browser via localStorage. Zero setup,
//                no API keys, good for trying out the UI/flow. Photos are
//                stored as data URLs, so the "stable photo URL" trick can't
//                be demoed for real in this mode (see backend-local.js),
//                and a real photo will make Gmail's signature editor
//                complain the signature is too long.
//   "supabase" - real multi-user backend (Auth + Postgres + Storage).
//                Requires the config in supabase-config.js to be filled in
//                and supabase-schema.sql run once in the Supabase SQL
//                Editor. See backend-supabase.js and the README.
export const BACKEND = "local";

// Only Google accounts on these domains may sign in. Enforced twice: right
// here in the app (immediately signs out and bounces anyone else back to
// the login page — see routeAfterLogin/requireAuth in auth-guard.js), and
// again at the database layer in supabase-schema.sql (a disallowed domain
// can never get a profile row inserted, even if someone bypassed the app
// entirely). Google itself has no concept of this restriction, so both
// layers matter.
export const ALLOWED_EMAIL_DOMAINS = ["gitam.in", "student.gitam.edu", "alumni.gitam.edu"];

export function isAllowedEmail(email) {
  const domain = (email || "").split("@")[1]?.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

// Where clicking the signature's bottom banner graphic should go by
// default. Individual admin-managed signatures can override this with
// their own banner image + link (see managed_signatures in the schema);
// self-service student signatures always use this default.
export const COLLEGE_WEBSITE_URL = "https://www.gitam.edu";

// The one account allowed into admin.html. This is just an identifier, not
// a secret, so it's fine hardcoded here — change it any time. The actual
// password is NOT stored anywhere in this codebase: create/change it
// directly in the Supabase dashboard (Authentication > Users), since this
// repo is public and a password committed here would be visible to anyone.
// If you change this email, also update is_admin() in supabase-schema.sql
// to match (re-run that CREATE OR REPLACE FUNCTION block in the SQL
// Editor) — both places enforce the same restriction independently.
export const ADMIN_EMAIL = "nitishraj.vinnakota2212@gmail.com";
