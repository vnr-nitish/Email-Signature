-- Run this in the Supabase SQL Editor if uploads (photo or banner) are
-- still failing with "new row violates row-level security policy" after
-- running supabase-followup-fixes.sql.
--
-- This rebuilds the same two policies, but replaces storage.foldername()
-- (a Supabase-internal helper whose exact behavior across versions isn't
-- something to take on faith) with split_part(), a plain standard Postgres
-- string function with well-documented, guaranteed behavior:
-- split_part('abc123/photo.png', '/', 1) = 'abc123'. Also schema-qualifies
-- `signatures` as `public.signatures` to rule out any search_path
-- ambiguity.

drop policy if exists "Owners can upload files for their own signatures" on storage.objects;
drop policy if exists "Owners can overwrite files for their own signatures" on storage.objects;

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

-- ============================================================================
-- If uploads STILL fail after this, run the query below separately and send
-- me its output — it lists every policy currently active on storage.objects
-- so I can see exactly what's there instead of guessing further.
-- ============================================================================
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
-- order by policyname;
