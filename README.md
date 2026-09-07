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

To make that URL **permanent**, this app generates one random token per user
the first time they upload a photo, stores it in Firestore, and reuses that
exact token on every future upload (`js/dashboard.js`). That's what keeps the
URL from changing even though the file behind it does.

## Stack

Plain HTML/CSS/JS (no build step) with a swappable backend adapter
([js/backend.js](js/backend.js)):
- **`local`** (default) — runs entirely in your browser via `localStorage`.
  Zero setup, no API keys, seeded with a demo login. Use this to try out the
  UI before wiring up a real backend.
- **`firebase`** — real multi-user backend: Authentication (email/password),
  Firestore (one `profiles/{uid}` doc per student), Storage (each photo at a
  fixed path, `photos/{uid}`).
- A `supabase` adapter can be dropped in the same way later — pages never
  call Firebase/Supabase directly, only `backend.js`.

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
Supabase). Once you're happy with the UI, switch `BACKEND` to `"firebase"`
(or a future `"supabase"`) to get that for real.

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
- In the real `firebase` backend, this is genuine Google OAuth
  (`signInWithPopup` + `GoogleAuthProvider`) — remember to enable the Google
  provider in Firebase Authentication (step 2 above).
- In local demo mode there's no real Google project to authenticate against,
  so it signs into a fixed stand-in account (`google-demo@signdemo.local`)
  just so you can see the flow. It becomes real the moment you switch
  `BACKEND` to `"firebase"`.

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
