# Email Signature Generator

A multi-user tool that lets students generate a Gmail-ready HTML email
signature with a profile photo, and copy it straight into Gmail's signature
settings. Sign-in is Google-only, restricted to GITAM's own domains.

## The sign-in flow

1. Student clicks **Continue with Google** on the login page.
2. The app checks their email domain (see below) — anything else is signed
   back out immediately.
3. First time in, their profile is empty, so they land on **Edit Profile**
   to fill in name/program/department/etc. and click **Save Details** (this
   locks the form — "Edit Details" unlocks it again later).
4. From there they land on the **Dashboard**, where they upload/crop a
   photo, pick a font, and copy the finished signature.
5. Anyone who already has a saved profile skips straight to the Dashboard
   on future logins.

This routing lives in one place — `routeAfterLogin()` in
[js/auth-guard.js](js/auth-guard.js) — called from `index.html` right after
Google redirects back, and checks the profile's `detailsSubmitted` flag to
decide Dashboard vs. Edit Profile.

## Domain restriction

Only `@gitam.in`, `@student.gitam.edu`, and `@alumni.gitam.edu` Google
accounts are allowed in. Google itself has no setting for this, so it's
enforced in two places:

- **The app** ([js/app-config.js](js/app-config.js) → `ALLOWED_EMAIL_DOMAINS`,
  checked by every protected page via `auth-guard.js`) — signs a disallowed
  account back out immediately and bounces them to the login page with an
  explanation. This is just a fast, friendly UX layer.
- **The database** ([supabase-schema.sql](supabase-schema.sql) →
  `is_allowed_domain()`) — a Postgres function used in the row-level-security
  policies for both the `profiles` table and the `avatars` storage bucket.
  This is the layer that actually matters: even someone who bypassed the
  app's JavaScript entirely could never get a profile row created or a
  photo uploaded from a disallowed account.

To change the allowed domains later, update both
`ALLOWED_EMAIL_DOMAINS` in `js/app-config.js` **and** the domain list inside
`is_allowed_domain()` in Supabase (SQL Editor → re-run the `create or
replace function` block from the schema file with the new list).

## How the "photo updates in old emails too" trick works

The signature never embeds the photo as a picture — it embeds an `<img
src="https://.../avatars/<uid>/photo.png">` **link**. Gmail (and every other
email client) re-fetches whatever is at that link every time an email is
opened, old or new. So when a student uploads a new photo, it overwrites the
file at that same URL, and every signature that ever referenced it —
including emails sent months ago — shows the new photo the next time someone
opens them. Nothing about the old email actually changes; it was only ever
pointing at a live link.

A Supabase public bucket's URL for a given path never changes on its own, so
uploading to the same `<uid>/photo.png` path every time (`upsert: true`, in
[js/backend-supabase.js](js/backend-supabase.js)) is all that's needed to
keep the URL permanently fixed — no manual token bookkeeping required.

## Stack

Plain HTML/CSS/JS (no build step, no framework) with a swappable backend
adapter ([js/backend.js](js/backend.js)):

- **`supabase`** — the real backend. Google-only Authentication, Postgres
  (one row per student in a `profiles` table), Storage (each photo at
  `avatars/<uid>/photo.png`).
- **`local`** (default until you configure Supabase) — runs entirely in your
  browser via `localStorage`, zero setup, no API keys, seeded with a demo
  login. Good for trying out the UI/flow, but photos are stored as data URLs
  baked directly into the copied signature — that means a real photo will
  likely trip Gmail's "signature too long" warning, and the "old emails
  auto-update" behavior can't be demonstrated for real, since both
  specifically require a real public, stable URL. Switch to `supabase` to
  get both for real.

Pages never call Supabase directly, only `backend.js` — the camelCase
profile shape (`fullName`, `photoURL`, etc.) is the same regardless of which
adapter is active; `backend-supabase.js` maps that to/from Postgres's
snake_case columns internally.

## One-time setup (Supabase)

1. Go to [supabase.com](https://supabase.com) and create a new project
   (free tier).
2. **Project Settings (gear icon) → API** — copy the **Project URL** and the
   **anon public** key (never the `service_role` key — that one must stay
   server-side) into [js/supabase-config.js](js/supabase-config.js).
3. **Authentication → Providers → Google** — enable it. Supabase's UI walks
   you through creating the Google OAuth client ID/secret it needs; you'll
   need a Google Cloud project for that (a free, separate thing from
   Supabase/Firebase).
4. **SQL Editor → New query** — paste and run
   [supabase-schema.sql](supabase-schema.sql). This creates the `profiles`
   table, the domain-restriction function + row-level-security policies, the
   public `avatars` storage bucket, and that bucket's upload policies, all in
   one go.
5. **Storage** — double check the `avatars` bucket exists and is marked
   **Public** (the script creates it, but worth confirming).
6. Set `BACKEND = "supabase"` in [js/app-config.js](js/app-config.js).

Send me the Project URL + anon key once you've done steps 1–2 and I'll wire
them in and push.

## Running it locally

Because this uses ES module imports, you can't just double-click the HTML
files (`file://` blocks module loading and clipboard access). Serve the
folder instead, e.g.:

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080` (or whatever port it prints). Note:
Google's OAuth redirect needs a real registered URL, so the Google sign-in
button won't complete on `localhost` once `BACKEND = "supabase"` — that part
needs to be tested on the deployed GitHub Pages URL.

## Profile fields

Set once on the Edit Profile page, in this order: **Name → Program →
Department → School → Campus → Mobile → Website**, plus up to five optional
social links (LinkedIn/Instagram/YouTube/Facebook/X). After clicking "Save
Details" the form locks (read-only) and an "Edit Details" button appears to
unlock it again — same pattern for the photo on the Dashboard page ("Change
Photo"). This state lives in the `detailsSubmitted` column.

Only social icons for links actually filled in are shown on the signature —
leave a field blank and that icon just doesn't render.

## Photo cropping

Selecting a photo on the Dashboard opens a crop tool
([js/photo-cropper.js](js/photo-cropper.js)) — drag to reposition, use the
slider to zoom, so your face lands inside the circle before it's saved. It
outputs a 320×320 circular PNG, which is what actually gets uploaded (not
the original file).

## Customizing the templates

- Edit [js/signature-template.js](js/signature-template.js) to change the
  signature markup/colors. Everything there uses **inline styles on
  purpose** — Gmail strips `<style>` blocks and external CSS when you paste,
  so only inline `style=""` attributes survive. Layout (widths, padding,
  vertical-align) is matched directly to GITAM's own production markup.
- Social icons and the bottom banner are your own images under
  [assets/](assets/) (`assets/icons/*.png`, `assets/banner.gif`), referenced
  by **relative path** in the template. At copy-time,
  [js/dashboard.js](js/dashboard.js) rewrites those to full absolute URLs
  based on wherever the app is currently being served from — so this works
  unchanged on `localhost` during development and on your real domain once
  deployed, with no config needed.
- The banner is rendered as a single flat image (no text overlaid on it via
  CSS) because Gmail's paste sanitizer unreliably strips background-image
  styling. If you get a finished banner graphic with your college's
  name/logo already baked in as one image, just replace
  `assets/banner.gif` with it — no code changes needed.
- The font is chosen per-student from a fixed list
  (`FONT_OPTIONS` in `js/signature-template.js`) — only fonts installed on
  virtually every device render reliably in an actual email; the others
  fall back to something close for recipients who don't have them.

## Known limitations

- No admin/bulk-invite flow — any allowed-domain Google account can sign
  itself up.
- No client-side image resizing beyond the crop tool's fixed 320×320 output.
- Works best in Gmail; other clients (especially Outlook desktop) render
  HTML signatures less faithfully — the template intentionally avoids
  flexbox/CSS-grid and SVG for that reason.
