// scripts/apply_admin_policies.js
// Executa as policies e a função admin_upsert_pricing_table via RPC execute_sql.
// Pré-requisito: existir um RPC SECURITY DEFINER execute_sql(sql text) acessível pelo role authenticated:
//   create or replace function execute_sql(sql text)
//   returns void language plpgsql security definer
//   as $$ begin execute sql; end; $$;
//   revoke all on function execute_sql(text) from public;
//   grant execute on function execute_sql(text) to authenticated;

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const STATEMENTS = [
  // pricing_tables policies
  `drop policy if exists "pricing_tables read all" on pricing_tables`,
  `drop policy if exists "pricing_tables admin write" on pricing_tables`,
  `drop policy if exists "pricing_tables owner write" on pricing_tables`,
  `create policy "pricing_tables read all" on pricing_tables for select using (true)`,
  `create policy "pricing_tables admin write" on pricing_tables for all using (exists (select 1 from profiles where lower(email) = lower(auth.email()) and type = 'admin')) with check (exists (select 1 from profiles where lower(email) = lower(auth.email()) and type = 'admin'))`,
  `create policy "pricing_tables owner write" on pricing_tables for all using (owner_email = lower(auth.email())) with check (owner_email = lower(auth.email()))`,

  // pricing_rows policies
  `drop policy if exists "pricing_rows read all" on pricing_rows`,
  `drop policy if exists "pricing_rows admin write" on pricing_rows`,
  `drop policy if exists "pricing_rows owner write" on pricing_rows`,
  `create policy "pricing_rows read all" on pricing_rows for select using (true)`,
  `create policy "pricing_rows admin write" on pricing_rows for all using (exists (select 1 from profiles where lower(email) = lower(auth.email()) and type = 'admin')) with check (exists (select 1 from profiles where lower(email) = lower(auth.email()) and type = 'admin'))`,
  `create policy "pricing_rows owner write" on pricing_rows for all using (exists (select 1 from pricing_tables t where t.id = pricing_rows.table_id and t.owner_email = lower(auth.email()))) with check (exists (select 1 from pricing_tables t where t.id = pricing_rows.table_id and t.owner_email = lower(auth.email())))`,
];

const FUNCTION_SQL = `
-- RPC admin_upsert_pricing_table (upsert atômico para admin com auditoria)
create or replace function admin_upsert_pricing_table(
  p_owner_email text,
  p_table jsonb,
  p_rows jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_table_id uuid;
  v_admin_email text;
  v_is_admin boolean;
begin
  -- Capturar email do usuário do JWT
  v_admin_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Verificar se o usuário é admin na tabela profiles
  select (type = 'admin') into v_is_admin
  from profiles
  where lower(email) = lower(v_admin_email);

  if not v_is_admin then
    raise exception 'forbidden';
  end if;

  -- Buscar ID da tabela existente ou criar nova
  select id into v_table_id
  from pricing_tables
  where lower(owner_email) = lower(p_owner_email);

  if v_table_id is null then
    -- Criar nova tabela
    insert into pricing_tables (id, owner_email, company, route, location, title, description, notes, payment_terms, schedule_type, is_active, updated_at, last_modified_by, last_modified_at, last_modified_by_type)
    values (
      coalesce((p_table->>'id')::uuid, gen_random_uuid()),
      lower(p_owner_email),
      p_table->>'company',
      p_table->>'route',
      p_table->>'location',
      coalesce(p_table->>'title', 'Tabela de Preços'),
      coalesce(p_table->>'description', ''),
      p_table->>'notes',
      p_table->>'payment_terms',
      p_table->>'schedule_type',
      coalesce((p_table->>'is_active')::boolean, true),
      now(),
      v_admin_email,
      now(),
      'admin'
    )
    returning id into v_table_id;
  else
    -- Atualizar tabela existente
    update pricing_tables set
      company = p_table->>'company',
      route = p_table->>'route',
      location = p_table->>'location',
      title = coalesce(p_table->>'title', 'Tabela de Preços'),
      description = coalesce(p_table->>'description', ''),
      notes = p_table->>'notes',
      payment_terms = p_table->>'payment_terms',
      schedule_type = p_table->>'schedule_type',
      is_active = coalesce((p_table->>'is_active')::boolean, true),
      updated_at = now(),
      last_modified_by = v_admin_email,
      last_modified_at = now(),
      last_modified_by_type = 'admin'
    where id = v_table_id;
  end if;

  delete from pricing_rows
  where table_id = v_table_id
    and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_rows));

  insert into pricing_rows (id, table_id, density_min, density_max, price_pf, price_pj, unit)
  select
    coalesce((value->>'id')::uuid, gen_random_uuid()),
    v_table_id,
    value->>'density_min',
    value->>'density_max',
    value->>'price_pf',
    value->>'price_pj',
    value->>'unit'
  from jsonb_array_elements(p_rows)
  on conflict (id) do update set
    density_min = excluded.density_min,
    density_max = excluded.density_max,
    price_pf = excluded.price_pf,
    price_pj = excluded.price_pj,
    unit = excluded.unit;

  return v_table_id;
end;
$$;

revoke all on function admin_upsert_pricing_table(text, jsonb, jsonb) from public;
grant execute on function admin_upsert_pricing_table(text, jsonb, jsonb) to authenticated;
`;

async function main() {
  console.log('Aplicando policies via execute_sql...');
  for (const statement of STATEMENTS) {
    const { error } = await supabase.rpc('execute_sql', { sql: `${statement};` });
    if (error) {
      console.error('Falhou ao aplicar statement:', statement);
      console.error(error);
      process.exit(1);
    }
  }

  console.log('Aplicando função admin_upsert_pricing_table via execute_sql...');
  const { error: fnError } = await supabase.rpc('execute_sql', { sql: FUNCTION_SQL });
  if (fnError) {
    console.error('Falhou ao criar/atualizar função:', fnError);
    process.exit(1);
  }

  console.log('Concluído com sucesso.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
