alter table public.pricing_tables
  add column if not exists is_active boolean not null default true;
