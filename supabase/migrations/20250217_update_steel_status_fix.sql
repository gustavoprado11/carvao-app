drop function if exists public.update_steel_status(uuid, text);

create or replace function public.update_steel_status(target_id uuid, new_status text)
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
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_record public.profiles%rowtype;
begin
  update public.profiles p
    set status = new_status,
        updated_at = timezone('utc', now())
  where p.id = target_id
    and p.type = 'steel'
  returning p.* into updated_record;

  if updated_record.id is null then
    return;
  end if;

  return query
    select
      updated_record.id,
      updated_record.email,
      updated_record.type,
      updated_record.company,
      updated_record.contact,
      updated_record.location,
      updated_record.supply_audience,
      updated_record.average_density_kg,
      updated_record.average_volume_m3,
      updated_record.status;
end;
$$;

grant execute on function public.update_steel_status(uuid, text) to anon, authenticated;
