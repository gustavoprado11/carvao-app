-- Adicionar campos de auditoria à tabela pricing_tables
alter table public.pricing_tables
  add column if not exists last_modified_by text,
  add column if not exists last_modified_at timestamptz,
  add column if not exists last_modified_by_type text check (last_modified_by_type in ('admin', 'owner'));

-- Índice para performance em buscas por modificador
create index if not exists pricing_tables_last_modified_by_idx
  on public.pricing_tables (last_modified_by);

-- Comentários para documentação
comment on column public.pricing_tables.last_modified_by is 'Email do usuário que fez a última modificação';
comment on column public.pricing_tables.last_modified_at is 'Timestamp da última modificação';
comment on column public.pricing_tables.last_modified_by_type is 'Tipo de quem modificou: admin ou owner';
