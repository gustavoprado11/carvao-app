-- Fix admin permission to update supplier profiles
-- The issue: current policy only checks JWT metadata, which may not reflect actual profile type
-- Solution: Check if the authenticated user has an admin profile in the profiles table

drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles
  for update using (
    -- User can update their own profile
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or
    -- OR user is an admin (check in profiles table, not just JWT)
    exists (
      select 1 from public.profiles admin_check
      where admin_check.id = auth.uid()
        and admin_check.type = 'admin'
    )
    or
    -- Fallback: check JWT metadata for admin type
    coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  )
  with check (
    -- Same logic for the check condition
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or
    exists (
      select 1 from public.profiles admin_check
      where admin_check.id = auth.uid()
        and admin_check.type = 'admin'
    )
    or
    coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  );
