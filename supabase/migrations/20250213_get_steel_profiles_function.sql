create or replace function public.get_steel_profiles()
returns table (
  id uuid,
  email text,
  company text,
  contact text,
  location text,
  supply_audience text,
  average_density_kg text,
  average_volume_m3 text,
  status text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    id,
    email,
    company,
    contact,
    location,
    supply_audience,
    average_density_kg,
    average_volume_m3,
    status
  from public.profiles
  where type = 'steel';
$$;

grant execute on function public.get_steel_profiles() to anon, authenticated;
