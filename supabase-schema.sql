-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- after creating your project and before setting BACKEND = "supabase".

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

-- Any logged-in student can look up any profile (needed so the app can
-- read a profile right after signup, before any other data exists).
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

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
-- the bucket, matching the path js/backend-supabase.js uploads to.
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can overwrite their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
