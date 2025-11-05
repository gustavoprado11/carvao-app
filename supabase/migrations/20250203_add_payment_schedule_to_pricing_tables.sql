alter table public.pricing_tables
  add column if not exists payment_terms text,
  add column if not exists schedule_type text check (schedule_type in ('agendamento', 'fila'));
