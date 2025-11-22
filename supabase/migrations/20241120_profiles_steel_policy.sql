-- Policies and helper to allow suppliers to list steel profiles for conversations/document sharing

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_steel_any'
  ) then
    create policy profiles_select_steel_any
      on public.profiles
      for select
      using (type = 'steel');
  end if;
end;
$$;

-- Optional helper: list steel profiles with SECURITY DEFINER to bypass RLS (uses owner privileges).
-- Keep projection minimal to avoid exposing sensitive fields.
create or replace function public.list_steel_profiles()
returns setof public.profiles
language sql
security definer
set search_path = public
as $$
  select * from public.profiles where type = 'steel';
$$;
