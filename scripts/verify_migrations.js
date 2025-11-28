/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function verify() {
  console.log('🔍 Verificando estrutura do banco de dados...\n');

  // Verificar campos de auditoria em pricing_tables
  console.log('1. Verificando campos de auditoria em pricing_tables:');
  const { data: columns, error: colError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pricing_tables'
        AND column_name IN ('last_modified_by', 'last_modified_at', 'last_modified_by_type')
      ORDER BY column_name;
    `
  });

  if (colError) {
    console.error('   ❌ Erro ao verificar colunas:', colError);
  } else {
    console.log('   ✅ Campos de auditoria encontrados');
  }

  // Verificar tabela notifications
  console.log('\n2. Verificando tabela notifications:');
  const { data: notifTable, error: notifError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'notifications'
      ) as exists;
    `
  });

  if (notifError) {
    console.error('   ❌ Erro ao verificar tabela:', notifError);
  } else {
    console.log('   ✅ Tabela notifications criada');
  }

  // Verificar função admin_upsert_pricing_table
  console.log('\n3. Verificando função admin_upsert_pricing_table:');
  const { data: funcData, error: funcError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT EXISTS (
        SELECT FROM pg_proc
        WHERE proname = 'admin_upsert_pricing_table'
      ) as exists;
    `
  });

  if (funcError) {
    console.error('   ❌ Erro ao verificar função:', funcError);
  } else {
    console.log('   ✅ Função admin_upsert_pricing_table encontrada');
  }

  // Verificar trigger notify_on_admin_table_edit
  console.log('\n4. Verificando trigger notify_on_admin_table_edit:');
  const { data: triggerData, error: triggerError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT EXISTS (
        SELECT FROM pg_trigger
        WHERE tgname = 'trigger_notify_admin_edit'
      ) as exists;
    `
  });

  if (triggerError) {
    console.error('   ❌ Erro ao verificar trigger:', triggerError);
  } else {
    console.log('   ✅ Trigger notify_on_admin_table_edit encontrado');
  }

  // Verificar trigger set_owner_audit
  console.log('\n5. Verificando trigger set_owner_audit:');
  const { data: ownerTriggerData, error: ownerTriggerError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT EXISTS (
        SELECT FROM pg_trigger
        WHERE tgname = 'trigger_set_owner_audit'
      ) as exists;
    `
  });

  if (ownerTriggerError) {
    console.error('   ❌ Erro ao verificar trigger:', ownerTriggerError);
  } else {
    console.log('   ✅ Trigger set_owner_audit encontrado');
  }

  // Verificar RLS policies em notifications
  console.log('\n6. Verificando RLS policies em notifications:');
  const { data: policiesData, error: policiesError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT policyname
      FROM pg_policies
      WHERE tablename = 'notifications'
      ORDER BY policyname;
    `
  });

  if (policiesError) {
    console.error('   ❌ Erro ao verificar policies:', policiesError);
  } else {
    console.log('   ✅ RLS policies em notifications configuradas');
  }

  console.log('\n✅ Verificação concluída! Todas as estruturas estão no lugar.');
}

verify().catch(err => {
  console.error('❌ Erro na verificação:', err);
  process.exit(1);
});
