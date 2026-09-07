-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- after creating your project and before setting BACKEND = "supabase".

create extension if not exists pgcrypto;

-- One row per student, keyed by their auth.users id.
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text default '',
  full_name text default '',
  program text default '',
  department text default '',
  school text default '',
  campus text default '',
  mobile text default '',
  website text default '',
  photo_url text default '',
  linkedin text default '',
  instagram text default '',
  youtube text default '',
  facebook text default '',
  twitter text default '',
  font_family text default 'Inter',
  details_submitted boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Keep this list in sync with ALLOWED_EMAIL_DOMAINS in js/app-config.js.
-- The app already checks this and signs disallowed users straight back
-- out, but that's only a UX nicety — this function is what actually makes
-- it impossible for anyone outside these domains to get a profile row or
-- upload a photo, even if they bypassed the app entirely. Google itself
-- has no concept of this restriction, so it has to be enforced here.
create or replace function is_allowed_domain()
returns boolean
language sql
stable
as $$
  select split_part(auth.jwt() ->> 'email', '@', 2) in ('gitam.in', 'student.gitam.edu', 'alumni.gitam.edu');
$$;

-- Keep this in sync with ADMIN_EMAIL in js/app-config.js. This is what
-- actually restricts the managed_signatures table and the banners bucket
-- to the one admin account, independent of anything the app's JavaScript
-- does.
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select auth.jwt() ->> 'email' = 'nitishraj.vinnakota2212@gmail.com';
$$;

-- Any logged-in student can look up any profile (needed so the app can
-- read a profile right after login, before any other data exists).
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile from an allowed domain"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id and is_allowed_domain());

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Public bucket for profile photos. Public read is required: Gmail (and
-- every other email client) fetches the <img src="..."> directly, with no
-- Supabase session attached at all.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Each student may only write inside their own "<uid>/..." folder within
-- the bucket, matching the path js/backend-supabase.js uploads to, and
-- only if their account is on an allowed domain.
create policy "Users can upload their own avatar from an allowed domain"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_allowed_domain()
  );

create policy "Users can overwrite their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Admin panel: signatures the admin builds directly, for any person or
-- organization — not tied to any auth.users row at all (the subject of the
-- signature never logs in; only the admin manages it).
-- ============================================================================

create table if not exists managed_signatures (
  id uuid primary key default gen_random_uuid(),
  full_name text default '',
  program text default '',
  department text default '',
  school text default '',
  campus text default '',
  mobile text default '',
  website text default '',
  photo_url text default '',
  linkedin text default '',
  instagram text default '',
  youtube text default '',
  facebook text default '',
  twitter text default '',
  font_family text default 'Inter',
  banner_url text default '',
  banner_link text default '',
  created_at timestamptz default now()
);

alter table managed_signatures enable row level security;

create policy "Only the admin can manage signatures"
  on managed_signatures for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Public bucket for admin-uploaded banner graphics (one per managed
-- signature, at "<signature-id>/banner"). Public read for the same reason
-- as avatars: email clients fetch it with no session at all.
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

create policy "Banner images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'banners');

create policy "Only the admin can manage banner uploads"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'banners' and is_admin())
  with check (bucket_id = 'banners' and is_admin());

-- The admin also uploads photos for managed signatures into the existing
-- avatars bucket, under a "managed/<id>/..." prefix (separate from each
-- student's own "<uid>/" folder, so it can't collide with a real uid).
create policy "Only the admin can manage photos for managed signatures"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'managed' and is_admin())
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'managed' and is_admin());
