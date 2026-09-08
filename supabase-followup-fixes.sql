-- Run this once in the Supabase SQL Editor. Safe to run even if you've
-- already run supabase-migration-signatures.sql — every statement here is
-- either idempotent (IF EXISTS / IF NOT EXISTS) or a clean drop-and-recreate.

-- New optional column: custom link text for the Website field (e.g. show
-- "Portfolio" instead of the raw URL). Falls back to the raw URL in the
-- template when left blank.
alter table signatures add column if not exists website_label text default '';

-- Clean up every storage policy this app has ever created (across every
-- earlier version of the schema) and recreate just the two needed now.
-- This resolves the "new row violates row-level security policy" error on
-- banner uploads, in case an earlier DROP POLICY in the migration didn't
-- exactly match what existed in your project.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Banner images are publicly readable" on storage.objects;
drop policy if exists "Signature files are publicly readable" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can upload their own avatar from an allowed domain" on storage.objects;
drop policy if exists "Users can overwrite their own avatar" on storage.objects;
drop policy if exists "Only the admin can manage banner uploads" on storage.objects;
drop policy if exists "Only the admin can manage photos for managed signatures" on storage.objects;
drop policy if exists "Owners can upload files for their own signatures" on storage.objects;
drop policy if exists "Owners can overwrite files for their own signatures" on storage.objects;

create policy "Signature files are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id in ('avatars', 'banners'));

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

-- Make sure both buckets actually exist and are public (harmless if they
-- already do).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('banners', 'banners', true)
on conflict (id) do update set public = true;
