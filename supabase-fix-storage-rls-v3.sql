-- Run this in the Supabase SQL Editor to fix uploads failing with "new row
-- violates row-level security policy".
--
-- The previous version of this policy checked ownership via a subquery
-- into the signatures table (does a signature with this ID belong to me?).
-- That's more moving parts than could be verified without direct access to
-- your project, so this replaces it with the simplest possible check: the
-- app now uploads to "<your-user-id>/<signature-id>/photo.png" (owner id
-- first), so the policy is just "is the first folder your own user id?" —
-- no subquery, no join, nothing left to go wrong. This matches Supabase's
-- own documented pattern for this exact use case.
--
-- IMPORTANT: this only takes effect for uploads made AFTER you've deployed
-- the matching code change (js/backend-supabase.js and js/signatures.js
-- now pass your user id into the upload path) — make sure that's live
-- before testing again.

drop policy if exists "Owners can upload files for their own signatures" on storage.objects;
drop policy if exists "Owners can overwrite files for their own signatures" on storage.objects;

create policy "Owners can upload files for their own signatures"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'banners')
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Owners can overwrite files for their own signatures"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and split_part(name, '/', 1) = auth.uid()::text
  );
