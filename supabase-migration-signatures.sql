-- ONE-TIME migration for an EXISTING project (yours) from the old
-- profiles/managed_signatures schema to the new unified "signatures"
-- table. Run this once in the Supabase SQL Editor. It preserves your
-- existing data — nothing is deleted until the final DROP TABLE
-- statements at the bottom, by which point everything has already been
-- copied across.
--
-- After running this, a fresh project would instead just run the plain
-- supabase-schema.sql (which reflects this same end state directly).

create extension if not exists pgcrypto;

create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null default 'My Signature',
  is_default boolean not null default false,
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
  font_family text default 'Georgia',
  banner_url text default '',
  banner_link text default '',
  details_submitted boolean not null default false,
  created_at timestamptz default now()
);

alter table signatures enable row level security;
grant usage on schema public to authenticated;
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

-- Migrate each student's profile into their "GITAM Signature". Reusing
-- their existing uid as the signature id keeps their current photo URL
-- (avatars/<uid>/photo.png) valid with zero changes.
insert into signatures (
  id, owner_id, name, is_default, full_name, program, department, school,
  campus, mobile, website, photo_url, linkedin, instagram, youtube,
  facebook, twitter, font_family, details_submitted, created_at
)
select
  id, id, 'GITAM Signature', true, full_name, program, department, school,
  campus, mobile, website, photo_url, linkedin, instagram, youtube,
  facebook, twitter, font_family, details_submitted, created_at
from profiles
on conflict (id) do nothing;

-- Migrate each admin-managed signature under the admin's own account.
insert into signatures (
  id, owner_id, name, is_default, full_name, program, department, school,
  campus, mobile, website, photo_url, linkedin, instagram, youtube,
  facebook, twitter, font_family, banner_url, banner_link, created_at
)
select
  id,
  (select id from auth.users where email = 'nitishraj.vinnakota2212@gmail.com'),
  coalesce(nullif(full_name, ''), 'Untitled Signature'),
  false, full_name, program, department, school, campus, mobile, website,
  photo_url, linkedin, instagram, youtube, facebook, twitter, font_family,
  banner_url, banner_link, created_at
from managed_signatures
on conflict (id) do nothing;

-- Storage: any signature's owner may read/write its own
-- "<signature-id>/..." folder in either bucket. This replaces both the
-- old per-uid avatar policies and the old admin-only managed/banner ones.
drop policy if exists "Users can upload their own avatar from an allowed domain" on storage.objects;
drop policy if exists "Users can overwrite their own avatar" on storage.objects;
drop policy if exists "Only the admin can manage photos for managed signatures" on storage.objects;
drop policy if exists "Only the admin can manage banner uploads" on storage.objects;

create policy "Owners can upload files for their own signatures"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'banners')
    and exists (
      select 1 from signatures s
      where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
    )
  );

create policy "Owners can overwrite files for their own signatures"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and exists (
      select 1 from signatures s
      where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
    )
  );

-- Old tables are no longer used by the app once BACKEND points at the new
-- schema (js/backend-supabase.js talks only to `signatures` now).
drop table if exists profiles;
drop table if exists managed_signatures;
