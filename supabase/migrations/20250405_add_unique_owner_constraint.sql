-- Adicionar constraint para garantir que cada owner tenha apenas uma tabela
-- Primeiro, limpar duplicatas mantendo apenas a mais recente

-- 1. Deletar tabelas duplicadas, mantendo apenas a mais recente de cada owner
delete from pricing_tables
where id in (
  select id
  from (
    select
      id,
      row_number() over (partition by lower(owner_email) order by updated_at desc nulls last, id desc) as rn
    from pricing_tables
  ) ranked
  where rn > 1
);

-- 2. Adicionar constraint de unicidade
create unique index if not exists pricing_tables_owner_email_unique
  on pricing_tables (lower(owner_email));

-- 3. Comentário explicativo
comment on index pricing_tables_owner_email_unique is 'Cada siderúrgica (owner) pode ter apenas uma tabela de preços';
