alter table public.profiles
  add column status text default 'pending';

update public.profiles
set status = 'approved'
where status is null;

alter table public.profiles
  alter column status set not null;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'approved'));

create index profiles_type_status_idx on public.profiles (type, status);
