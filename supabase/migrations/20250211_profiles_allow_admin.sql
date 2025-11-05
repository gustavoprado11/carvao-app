alter table public.profiles
  drop constraint if exists profiles_type_check;

alter table public.profiles
  add constraint profiles_type_check
  check (type in ('supplier', 'steel', 'admin'));
