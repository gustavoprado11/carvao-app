alter table public.profiles
  add column if not exists supply_audience text check (supply_audience in ('pf','pj','both')),
  add column if not exists average_density_kg text,
  add column if not exists average_volume_m3 text;
