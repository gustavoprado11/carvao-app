/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function testAdminAccess() {
  console.log('🧪 Testando acesso de admin...\n');

  // 1. Verificar se existem perfis admin
  console.log('1. Buscando perfis admin:');
  const { data: admins, error: adminError } = await supabase
    .from('profiles')
    .select('email, type')
    .eq('type', 'admin');

  if (adminError) {
    console.error('   ❌ Erro ao buscar admins:', adminError);
    return;
  }

  if (!admins || admins.length === 0) {
    console.log('   ⚠️  Nenhum perfil admin encontrado no banco');
    console.log('   💡 Crie um perfil admin primeiro');
    return;
  }

  console.log(`   ✅ Encontrados ${admins.length} admin(s):`);
  admins.forEach(admin => {
    console.log(`      - ${admin.email}`);
  });

  // 2. Verificar policies
  console.log('\n2. Verificando policies:');
  const { data: policies, error: policiesError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT policyname, cmd
      FROM pg_policies
      WHERE tablename IN ('pricing_tables', 'pricing_rows')
      AND policyname LIKE '%admin%'
      ORDER BY tablename, policyname;
    `
  });

  if (policiesError) {
    console.error('   ❌ Erro ao verificar policies:', policiesError);
  } else {
    console.log('   ✅ Policies admin configuradas');
  }

  // 3. Verificar função admin_upsert_pricing_table
  console.log('\n3. Verificando função admin_upsert_pricing_table:');
  const { data: funcCheck, error: funcError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT
        p.proname as name,
        pg_get_functiondef(p.oid) LIKE '%select (type = ''admin'') into v_is_admin%' as has_admin_check
      FROM pg_proc p
      WHERE p.proname = 'admin_upsert_pricing_table';
    `
  });

  if (funcError) {
    console.error('   ❌ Erro ao verificar função:', funcError);
  } else {
    console.log('   ✅ Função admin_upsert_pricing_table verificada');
  }

  console.log('\n✅ Verificação de acesso admin concluída!');
  console.log('\n💡 Próximo passo: Tente salvar uma tabela pelo app como admin');
}

testAdminAccess().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
