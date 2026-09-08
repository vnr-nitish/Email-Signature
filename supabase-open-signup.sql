-- Run this once in the Supabase SQL Editor. Opens sign-in/signature
-- creation to any Google account, while keeping the auto-created default
-- "GITAM Signature" restricted to verified GITAM accounts (or the admin).

drop policy if exists "Users manage their own signatures" on signatures;

create policy "Users manage their own signatures"
  on signatures for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (is_default = false or is_allowed_domain() or is_admin())
  );
