create or replace function public.get_steel_profiles_by_status(target_status text)
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
  where type = 'steel'
    and (target_status is null or status = target_status);
$$;

grant execute on function public.get_steel_profiles_by_status(text) to anon, authenticated;
