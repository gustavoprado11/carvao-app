create or replace function public.seed_profile(
  p_id uuid,
  p_email text,
  p_type text,
  p_company text default null,
  p_contact text default null,
  p_location text default null,
  p_supply_audience text default null,
  p_average_density text default null,
  p_average_volume text default null,
  p_status text default null
)
returns table (
  id uuid,
  email text,
  type text,
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
  insert into public.profiles as p (
    id,
    email,
    type,
    company,
    contact,
    location,
    supply_audience,
    average_density_kg,
    average_volume_m3,
    status
  )
  values (
    p_id,
    lower(p_email),
    p_type,
    nullif(btrim(p_company), ''),
    nullif(btrim(p_contact), ''),
    nullif(btrim(p_location), ''),
    nullif(btrim(p_supply_audience), ''),
    nullif(btrim(p_average_density), ''),
    nullif(btrim(p_average_volume), ''),
    coalesce(p_status, case when p_type = 'steel' then 'pending' else 'approved' end)
  )
  on conflict (id) do update
    set company = excluded.company,
        contact = excluded.contact,
        location = excluded.location,
        supply_audience = excluded.supply_audience,
        average_density_kg = excluded.average_density_kg,
        average_volume_m3 = excluded.average_volume_m3,
        status = excluded.status,
        type = excluded.type,
        email = excluded.email,
        updated_at = timezone('utc', now())
    where p.id = excluded.id
  returning
    p.id,
    p.email,
    p.type,
    p.company,
    p.contact,
    p.location,
    p.supply_audience,
    p.average_density_kg,
    p.average_volume_m3,
    p.status;
$$;

grant execute on function public.seed_profile(uuid, text, text, text, text, text, text, text, text, text) to anon, authenticated;
