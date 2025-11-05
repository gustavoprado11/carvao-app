do $$
begin
  if to_regclass('public.pricing_rows') is not null then
    drop policy if exists pricing_rows_manage_owner on public.pricing_rows;
    drop policy if exists pricing_rows_select_authenticated on public.pricing_rows;
  end if;
  if to_regclass('public.pricing_tables') is not null then
    drop policy if exists pricing_tables_manage_owner on public.pricing_tables;
    drop policy if exists pricing_tables_select_authenticated on public.pricing_tables;
  end if;
exception
  when others then
    null;
end;
$$;

create table if not exists public.pricing_tables (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null references public.profiles(email) on delete cascade,
  company text,
  route text,
  location text,
  title text not null,
  description text not null,
  notes text,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pricing_rows (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.pricing_tables(id) on delete cascade,
  density_min text,
  density_max text,
  price_pf text,
  price_pj text,
  unit text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pricing_rows_table_id_idx on public.pricing_rows (table_id);

alter table public.pricing_tables enable row level security;
alter table public.pricing_rows enable row level security;

create policy pricing_tables_select_authenticated on public.pricing_tables
  for select using (auth.role() = 'authenticated');

create policy pricing_tables_manage_owner on public.pricing_tables
  for all using (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy pricing_rows_select_authenticated on public.pricing_rows
  for select using (auth.role() = 'authenticated');

create policy pricing_rows_manage_owner on public.pricing_rows
  for all using (
    exists (
      select 1
      from public.pricing_tables t
      where t.id = pricing_rows.table_id
        and lower(t.owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1
      from public.pricing_tables t
      where t.id = pricing_rows.table_id
        and lower(t.owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
