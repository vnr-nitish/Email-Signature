# Email Signature Generator

A small multi-user tool that lets students generate a Gmail-ready HTML email
signature with a profile photo, and copy it straight into Gmail's signature
settings.

## How the "photo updates in old emails too" trick works

The signature never embeds the photo as a picture — it embeds an
`<img src="https://.../photos/<your-uid>?...">` **link**. Gmail (and every
other email client) re-fetches whatever is at that link every time an email
is opened, old or new. So when you upload a new photo, it overwrites the file
at that same URL, and every signature that ever referenced it — including
emails sent months ago — shows the new photo the next time someone opens
them. Nothing about the old email actually changes; it was only ever
pointing at a live link.

How that URL stays **permanent** depends on the backend:
- **Firebase**: a random token is generated once per user, stored in
  Firestore, and reused on every future upload (`js/backend-firebase.js`) —
  Firebase Storage would otherwise mint a new token (and therefore a new
  URL) on every re-upload.
- **Supabase**: no token needed. A public bucket's URL for a given path is
  stable by construction, so uploading to the same `<uid>/photo.png` path
  every time (`upsert: true`, in `js/backend-supabase.js`) already keeps the
  URL fixed.

## Stack

Plain HTML/CSS/JS (no build step) with a swappable backend adapter
([js/backend.js](js/backend.js)):
- **`local`** (default) — runs entirely in your browser via `localStorage`.
  Zero setup, no API keys, seeded with a demo login. Use this to try out the
  UI before wiring up a real backend.
- **`firebase`** — real multi-user backend: Authentication (email/password),
  Firestore (one `profiles/{uid}` doc per student), Storage (each photo at a
  fixed path, `photos/{uid}`).
- **`supabase`** — real multi-user backend: Authentication (email/password +
  Google), Postgres (one row per student in a `profiles` table), Storage
  (each photo at `avatars/<uid>/photo.png`).
- Pages never call Firebase/Supabase directly, only `backend.js` — the
  camelCase profile shape (`fullName`, `photoURL`, etc.) is the same
  regardless of which adapter is active; `js/backend-supabase.js` maps that
  to/from Postgres's snake_case columns internally.

## Try it now — demo mode (no setup)

The app currently runs in **local demo mode** (`BACKEND = "local"` in
[js/app-config.js](js/app-config.js)). Serve the folder (see below) and log
in with:

```
Email:    demo@signdemo.local
Password: demo1234
```

That account comes pre-filled with sample profile data so the dashboard
looks realistic immediately. You can also just click "Sign up" and create
your own account — in this mode it's stored in your browser only (nobody
else can see or log into it), so any email/password works.

**Limitation of this mode:** photos are stored as data URLs embedded
directly in the copied signature HTML, not as a live server link. That means
you can test the whole UI/UX — sign up, edit profile, upload a photo,
copy a signature — but not the actual "old emails auto-update" behavior,
since that specifically requires a real public, stable URL (Firebase or
Supabase). It also means a real photo will likely trip Gmail's "signature
too long" warning, since the embedded photo alone is often 100KB+ of text.
Both of those need a real backend — switch `BACKEND` to `"firebase"` or
`"supabase"` once you're ready (see below).

## One-time setup (for the real `supabase` backend)

1. Go to [supabase.com](https://supabase.com) and create a new project
   (free tier).
2. **Project Settings (gear icon) > API** — copy the **Project URL** and the
   **anon public** key (never the `service_role` key — that one must stay
   server-side) into [js/supabase-config.js](js/supabase-config.js).
3. **Authentication > Providers > Email** — for instant login right after
   signup during development, turn **off** "Confirm email". Turn it back on
   before a real rollout (students will then need to click a confirmation
   link before their first login).
4. **Authentication > Providers > Google** — enable it if you want
   "Continue with Google" to actually work (Supabase's UI walks you through
   creating the Google OAuth client ID/secret it needs).
5. **SQL Editor > New query** — paste and run
   [supabase-schema.sql](supabase-schema.sql). This creates the `profiles`
   table, its row-level-security policies, the public `avatars` storage
   bucket, and that bucket's upload policies.
6. **Storage** — double check the `avatars` bucket exists and is marked
   **Public** (the script creates it, but worth confirming).
7. Set `BACKEND = "supabase"` in [js/app-config.js](js/app-config.js).

## One-time setup (for the real `firebase` backend)

1. Go to the [Firebase console](https://console.firebase.google.com) and
   create a new project.
2. **Build > Authentication > Sign-in method** — enable **Email/Password**
   and **Google**.
3. **Build > Firestore Database** — create a database (any region, start in
   production mode).
4. **Build > Storage** — click "Get started" (production mode).
5. **Project settings (gear icon) > General > Your apps** — click the web
   icon (`</>`) to register a web app, and copy the `firebaseConfig` object
   it gives you.
6. Paste those values into [js/firebase-config.js](js/firebase-config.js).
7. In the console, open **Firestore Database > Rules**, and paste in the
   contents of [firestore.rules](firestore.rules). Do the same for
   **Storage > Rules** using [storage.rules](storage.rules).
8. Set `BACKEND = "firebase"` in [js/app-config.js](js/app-config.js). You
   can also set `ALLOWED_EMAIL_DOMAIN` there (e.g. `"@student.gitam.edu"`)
   to restrict sign-ups to your college's email domain.

## Running it locally

Because this uses ES module imports, you can't just double-click the HTML
files (`file://` blocks module loading and clipboard access). Serve the
folder instead, e.g.:

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080` (or whatever port it prints).

## Deploying it for real

Easiest option is Firebase Hosting, which is free and lives in the same
project:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # pick this project, public dir = ".", single-page = No
firebase deploy
```

## Profile fields

Set once on the Profile page, in this order: **Name → Program → Department →
School → Campus → Mobile → Website**, plus up to five optional social links
(LinkedIn/Instagram/YouTube/Facebook/X). After you click "Save Details" the
form locks (read-only) and a "Edit Details" button appears to unlock it
again — same pattern for the photo on the Dashboard page ("Change Photo").
This state lives in the `detailsSubmitted` field on the profile document.

Only social icons for links you actually filled in are shown on the
signature — leave a field blank and that icon just doesn't render.

## Photo cropping

Selecting a photo on the Dashboard opens a crop tool
([js/photo-cropper.js](js/photo-cropper.js)) — drag to reposition, use the
slider to zoom, so your face lands inside the circle before it's saved. It
outputs a 320×320 circular PNG, which is what actually gets uploaded (not
the original file), and it works with both the local demo backend and
Firebase.

## Google sign-in

The Login page has a "Continue with Google" button.
- In `firebase`, this is a popup (`signInWithPopup` + `GoogleAuthProvider`)
  — remember to enable the Google provider in Firebase Authentication.
- In `supabase`, this is a full-page redirect to Google and back
  (`signInWithOAuth`) rather than a popup — that's how Supabase's OAuth
  flow works. It lands back on the Dashboard already logged in.
- In local demo mode there's no real Google project to authenticate against,
  so it signs into a fixed stand-in account (`google-demo@signdemo.local`)
  just so you can see the flow.

## Customizing the templates

- Edit [js/signature-template.js](js/signature-template.js) to change the
  signature markup/colors. Everything there uses **inline styles on purpose**
  — Gmail strips `<style>` blocks and external CSS when you paste, so only
  inline `style=""` attributes survive.
- Social icons and the bottom banner are your own images under
  [assets/](assets/) (`assets/icons/*.png`, `assets/banner.gif`), referenced
  by **relative path** in the template. At copy-time,
  [js/dashboard.js](js/dashboard.js) rewrites those to full absolute URLs
  based on wherever the app is currently being served from — so this works
  unchanged on `localhost` during development and on your real domain once
  deployed, with no config needed. One consequence: a signature copied while
  testing on `localhost` will show broken icons if opened from another
  device, since `localhost` isn't reachable from anywhere else — that
  resolves itself automatically once you deploy.
- The banner is rendered as a single flat image (no text overlaid on it via
  CSS) because Gmail's paste sanitizer unreliably strips background-image
  styling. If you get a finished banner graphic with your college's
  name/logo already baked in as one image, just replace
  `assets/banner.gif` with it — no code changes needed.

## Known limitations

- No admin/bulk-invite flow yet — students self-sign-up.
- No client-side image resizing beyond the crop tool's fixed 320×320 output;
  uploads are capped at 5MB by the Storage rules.
- Works best in Gmail; other clients (especially Outlook desktop) render
  HTML signatures less faithfully — the template intentionally avoids
  flexbox/CSS-grid and SVG for that reason.
