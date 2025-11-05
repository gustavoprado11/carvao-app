create or replace function public.get_supplier_profiles(emails text[])
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
  with normalized_emails as (
    select array_agg(distinct lower(e)) as items
    from unnest(coalesce(emails, array[]::text[])) as t(e)
  )
  select
    p.id,
    p.email,
    p.company,
    p.contact,
    p.location,
    p.supply_audience,
    p.average_density_kg,
    p.average_volume_m3,
    p.status
  from public.profiles p
  cross join normalized_emails ne
  where p.type = 'supplier'
    and lower(p.email) = any (coalesce(ne.items, array[]::text[]));
$$;

grant execute on function public.get_supplier_profiles(text[]) to anon, authenticated;
