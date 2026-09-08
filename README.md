# Email Signature Generator

A tool that lets anyone with access generate a Gmail-ready HTML email
signature with a profile photo, and copy it straight into Gmail's signature
settings. Every account — a GITAM student/faculty signed in with Google, or
the one admin account — can hold **multiple independent signatures**,
switchable from a sidebar, for people who also need a signature for a
different affiliation (a side company, another organization, etc).

## The sign-in flow

1. A GITAM student/faculty clicks **Continue with Google** on the login
   page; the admin instead logs in separately at `admin-login.html` with
   email/password (see "The admin account" below for why).
2. The app checks the signed-in email is either an allowed GITAM domain or
   the admin account (see "Domain restriction") — anything else is signed
   back out immediately.
3. A first-time GITAM login gets one signature auto-created, named "GITAM
   Signature". The admin gets nothing auto-created — it starts empty.
4. Everyone lands on **signatures.html**: a sidebar listing their
   signatures, a **+ New Signature** button to add more, and two tabs for
   whichever signature is selected — **Details** (the form fields) and
   **Signature** (photo, font, banner for non-default signatures, and the
   two copyable templates).

This routing lives in one place — `routeAfterLogin()` in
[js/auth-guard.js](js/auth-guard.js) — called from `index.html` right after
Google redirects back.

## One account, many signatures

Every signature is a full, independent record: its own name/role/
organization fields, its own photo, its own font, and — for anything other
than the default GITAM one — its own banner image and click-through link.
They all belong to whichever account created them (`owner_id` in the
`signatures` table), and row-level security means an account can only ever
see or touch its own rows.

The **default GITAM signature** and **any signature you add yourself** use
the same four underlying fields, just labeled differently depending on
context (`LABELS` in [js/signatures.js](js/signatures.js)):

| Column      | Default ("GITAM Signature") | Any other signature        |
| ----------- | ---------------------------- | --------------------------- |
| `program`   | Program (with course)        | Position / Designation / Role |
| `department`| Department                   | Wing / Branch                |
| `school`    | School                        | Institute / Organization     |
| `campus`    | Campus                        | Location                     |

The default signature always uses the shared GITAM banner
(`assets/banner.gif`) and `COLLEGE_WEBSITE_URL`; any other signature shows
an extra "Banner" section on its Signature tab to upload its own and set
where clicking it goes.

This replaced an earlier separate "admin panel" design (one bespoke UI just
for the admin to build one-off signatures for other people). It's simpler
now: the admin is just an account that happens to create lots of custom
signatures instead of one, using the exact same "+ New Signature" flow any
student can use for a second job/affiliation.

## Domain restriction

Only `@gitam.in`, `@student.gitam.edu`, and `@alumni.gitam.edu` Google
accounts get a default signature auto-created and can create their own.
Google itself has no setting for this, so it's enforced in two places:

- **The app** ([js/app-config.js](js/app-config.js) → `ALLOWED_EMAIL_DOMAINS`,
  checked in `js/auth-guard.js`) — signs a disallowed account back out
  immediately and bounces them to the login page with an explanation. This
  is just a fast, friendly UX layer.
- **The database** ([supabase-schema.sql](supabase-schema.sql) →
  `is_allowed_domain()`) — used in the `signatures` table's row-level-security
  policy alongside `is_admin()`: a row can only be *created* by an
  allowed-domain account or the admin account. This is the layer that
  actually matters: even someone who bypassed the app's JavaScript entirely
  could never get a signature row created from a disallowed account.

To change the allowed domains later, update both `ALLOWED_EMAIL_DOMAINS` in
`js/app-config.js` **and** the domain list inside `is_allowed_domain()` in
Supabase (SQL Editor → re-run that `create or replace function` block with
the new list).

## The admin account

`admin-login.html` is a separate, Google-independent login (plain
email/password via Supabase Auth) for exactly one account — the domain
restriction above doesn't apply to it. Once logged in, it lands on the
exact same `signatures.html` as everyone else; the only difference is it
never gets a default signature auto-created, so it starts empty and uses
"+ New Signature" for everything.

**Why the password isn't in this codebase:** this repo is public. A
password committed here would be visible to anyone who opens the file on
GitHub. Since email/password auth is already a first-class Supabase
feature, there's no need to invent a custom check — you create the real
account with that email + your chosen password directly in the Supabase
dashboard (Authentication → Users → Add user), and `signInWithPassword`
verifies it server-side. To change the password later, do it there — never
in code. To change the *admin email*, update it in two places:
`ADMIN_EMAIL` in `js/app-config.js`, and inside `is_admin()` in
`supabase-schema.sql` (re-run that `create or replace function` block with
the new email).

## How the "photo updates in old emails too" trick works

The signature never embeds the photo as a picture — it embeds an `<img
src="https://.../avatars/<signature-id>/photo.png">` **link**. Gmail (and
every other email client) re-fetches whatever is at that link every time an
email is opened, old or new. So uploading a new photo overwrites the file at
that same URL, and every signature that ever referenced it — including
emails sent months ago — shows the new photo the next time someone opens
them. Nothing about the old email actually changes; it was only ever
pointing at a live link. The same applies to a custom signature's banner.

Two things make this actually work in practice, both in
[js/backend-supabase.js](js/backend-supabase.js):
- Uploading to the exact same `<signature-id>/photo.png` path every time
  (`upsert: true`) keeps the URL permanently fixed — a Supabase public
  bucket's URL for a given path never changes on its own.
- `cacheControl: "0"` on every upload, so nothing (your browser, a CDN in
  front of Storage, Gmail's image proxy) treats that URL as safely
  cacheable without checking first. On top of that,
  [js/signatures.js](js/signatures.js) appends a fresh timestamp to the URL
  every time it's *displayed or copied* (never persisted) — belt-and-braces
  against any caching layer that doesn't fully honor the header.

In practice, expect a couple of minutes' delay before an already-sent email
picks up a new photo — that's Gmail's own image proxy cache, outside this
app's control.

## Stack

Plain HTML/CSS/JS (no build step, no framework) with a swappable backend
adapter ([js/backend.js](js/backend.js)):

- **`supabase`** — the real backend. Google Authentication (domain-gated)
  plus a separate email/password login for the admin, one Postgres
  `signatures` table (RLS-scoped to `owner_id`), Storage (`avatars` and
  `banners` buckets, each file at `<signature-id>/...`).
- **`local`** (fallback if Supabase isn't configured) — runs entirely in
  your browser via `localStorage`, zero setup, no API keys, seeded with a
  demo login. Good for trying out the UI/flow, but photos are stored as
  data URLs baked directly into the copied signature — a real photo will
  likely trip Gmail's "signature too long" warning, and the "old emails
  auto-update" behavior can't be demonstrated for real, since both
  specifically require a real public, stable URL.

Pages never call Supabase directly, only `backend.js` — the camelCase
signature shape (`fullName`, `photoURL`, `bannerURL`, etc.) is the same
regardless of which adapter is active; `backend-supabase.js` maps that
to/from Postgres's snake_case columns internally.

## One-time setup (Supabase)

**Already have the old `profiles`/`managed_signatures` tables from an
earlier version of this app?** Run
[supabase-migration-signatures.sql](supabase-migration-signatures.sql)
instead of `supabase-schema.sql` — it creates the new `signatures` table,
copies your existing data into it, and only then drops the old tables.
**A fresh project** should run `supabase-schema.sql` directly.

1. Go to [supabase.com](https://supabase.com) and create a new project
   (free tier).
2. **Project Settings (gear icon) → API** — copy the **Project URL** and the
   **anon public** key (never the `service_role` key — that one must stay
   server-side) into [js/supabase-config.js](js/supabase-config.js).
3. **Project Settings → Data API**:
   - **Enable Data API** — ON (required; this is what `supabase-js` talks
     to).
   - **Automatically expose new tables** — OFF (Supabase's own
     recommendation; the schema/migration files already include the
     explicit `grant` statements this would otherwise have done
     automatically, so nothing breaks by turning it off).
   - **Enable automatic RLS** — ON (free safety net for any table added
     later).
4. **Authentication → Providers → Google** — enable it. Supabase's UI walks
   you through creating the Google OAuth client ID/secret it needs; you'll
   need a Google Cloud project for that (a free, separate thing from
   Supabase).
5. **SQL Editor → New query** — paste and run whichever of
   `supabase-schema.sql` / `supabase-migration-signatures.sql` applies (see
   above).
6. **Storage** — double check the `avatars` and `banners` buckets exist and
   are marked **Public**.
7. **Authentication → Users → Add user** — create the admin account: email
   `nitishraj.vinnakota2212@gmail.com`, set the password directly here
   (never in code — see "The admin account" above), check "Auto Confirm
   User".
8. Set `BACKEND = "supabase"` in [js/app-config.js](js/app-config.js).

## Running it locally

Because this uses ES module imports, you can't just double-click the HTML
files (`file://` blocks module loading and clipboard access). Serve the
folder instead, e.g.:

```bash
npx serve .
# or
python -m http.server 8080
```

Google's OAuth redirect needs a real registered URL, so the Google
sign-in button won't complete on `localhost` once `BACKEND = "supabase"` —
that part needs to be tested on the deployed URL.

## Photo cropping

Selecting a photo on the Signature tab opens a crop tool
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
- Social icons are your own images under [assets/icons/](assets/icons/),
  referenced by **relative path** in the template — always the same five,
  regardless of signature type. The default banner
  (`assets/banner.gif`) is likewise a relative path; a custom signature's
  own banner is instead an absolute Supabase Storage URL. At copy-time,
  [js/signatures.js](js/signatures.js) rewrites relative paths to full
  absolute URLs based on wherever the app is currently being served from —
  so this works unchanged on `localhost` during development and on your
  real domain once deployed.
- The font is chosen per-signature from a fixed list (`FONT_OPTIONS` in
  `js/signature-template.js`) — only fonts installed on virtually every
  device render reliably in an actual email; the others fall back to
  something close for recipients who don't have them.

## Known limitations

- No bulk-invite flow — any allowed-domain Google account can sign itself
  up; the admin covers one-off/manual signature creation, not bulk
  provisioning.
- No client-side image resizing beyond the crop tool's fixed 320×320 output.
- Deleting a signature doesn't clean up its uploaded photo/banner files in
  Storage — they just become orphaned, harmless but unused.
- Works best in Gmail; other clients (especially Outlook desktop) render
  HTML signatures less faithfully — the template intentionally avoids
  flexbox/CSS-grid and SVG for that reason.
