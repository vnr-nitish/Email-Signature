-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- for a FRESH project, before setting BACKEND = "supabase". If you already
-- ran an earlier version of this file (with separate profiles/
-- managed_signatures tables), use supabase-migration-signatures.sql
-- instead — it transitions your existing data to this same end state.

create extension if not exists pgcrypto;

grant usage on schema public to authenticated;

-- Keep this list in sync with ALLOWED_EMAIL_DOMAINS in js/app-config.js.
-- The app already checks this and signs disallowed users straight back
-- out, but that's only a UX nicety — this function is what actually makes
-- it impossible for anyone outside these domains to get a signature row,
-- even if someone bypassed the app entirely. Google itself has no concept
-- of this restriction, so it has to be enforced here.
create or replace function is_allowed_domain()
returns boolean
language sql
stable
as $$
  select split_part(auth.jwt() ->> 'email', '@', 2) in ('gitam.in', 'student.gitam.edu', 'alumni.gitam.edu');
$$;

-- Keep this in sync with ADMIN_EMAIL in js/app-config.js. This is what
-- actually lets the admin account own signatures despite not being on an
-- allowed domain, independent of anything the app's JavaScript does.
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select auth.jwt() ->> 'email' = 'nitishraj.vinnakota2212@gmail.com';
$$;

-- One row per signature. A student's first login auto-creates one flagged
-- is_default = true ("GITAM Signature"); any account (student or admin)
-- can create any number of additional ones for other affiliations. Every
-- signature belongs to exactly one authenticated owner — there's no
-- "signature with no login" concept anymore (see the admin panel note in
-- the README for why that changed).
create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null default 'My Signature',
  is_default boolean not null default false,
  -- program/department/school/campus double as designation/wing/
  -- institute/location for a non-default signature — same four slots,
  -- just relabeled per signature type in the UI (see js/signatures.js).
  full_name text default '',
  program text default '',
  department text default '',
  school text default '',
  campus text default '',
  mobile text default '',
  website text default '',
  website_label text default '',
  photo_url text default '',
  linkedin text default '',
  instagram text default '',
  youtube text default '',
  facebook text default '',
  twitter text default '',
  font_family text default 'Georgia',
  banner_url text default '',
  banner_link text default '',
  details_submitted boolean not null default false,
  created_at timestamptz default now()
);

alter table signatures enable row level security;
grant select, insert, update, delete on signatures to authenticated;

-- A signature can be created only by an allowed-domain student or the
-- admin account — the same two ways anyone can be authenticated at all
-- (Google sign-in is domain-gated in the app, and admin-login.html is the
-- only other way in). Once a signature exists, its owner can freely
-- read/update/delete it — no further domain check needed there.
create policy "Users manage their own signatures"
  on signatures for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and (is_allowed_domain() or is_admin()));

-- Public buckets for signature photos and custom banners. Public read is
-- required: Gmail (and every other email client) fetches the <img
-- src="..."> directly, with no Supabase session attached at all.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('banners', 'banners', true)
on conflict (id) do nothing;

create policy "Signature files are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id in ('avatars', 'banners'));

-- Each file lives at "<signature-id>/...". Whoever owns that signature
-- (checked via a lookup into the signatures table above) can write there,
-- in either bucket.
create policy "Owners can upload files for their own signatures"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'banners')
    and exists (
      select 1 from public.signatures s
      where s.id::text = split_part(name, '/', 1)
      and s.owner_id = auth.uid()
    )
  );

create policy "Owners can overwrite files for their own signatures"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and exists (
      select 1 from public.signatures s
      where s.id::text = split_part(name, '/', 1)
      and s.owner_id = auth.uid()
    )
  );
