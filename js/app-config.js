// Which backend adapter to use. Every page talks to "./backend.js", which
// just re-exports whichever of these is selected here — so switching
// backends later (e.g. Firebase -> Supabase) means changing this one line,
// not touching any page's HTML/JS.
//
//   "local"    - runs entirely in the browser via localStorage. Zero setup,
//                no API keys, good for trying out the UI/flow. Photos are
//                stored as data URLs, so the "stable photo URL" trick can't
//                be demoed for real in this mode (see backend-local.js).
//   "firebase" - real multi-user backend (Auth + Firestore + Storage).
//                Requires the config in firebase-config.js to be filled in.
export const BACKEND = "local";

// Optional: restrict sign-up to a specific college email domain.
// Leave as "" to allow any email address to sign up.
export const ALLOWED_EMAIL_DOMAIN = "";

// Where clicking the signature's bottom banner graphic should go. Same
// destination for every user (it's the college site), so it's one constant
// rather than a per-student profile field.
export const COLLEGE_WEBSITE_URL = "https://www.gitam.edu";
