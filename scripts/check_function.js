/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkFunction() {
  console.log('🔍 Verificando função admin_upsert_pricing_table...\n');

  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      WHERE p.proname = 'admin_upsert_pricing_table';
    `
  });

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log('Definição da função:\n');
  console.log('---');
  if (data && data.length > 0) {
    console.log('Função encontrada!');
    console.log('\nProcurando por "return v_table_id" na definição...');

    // A função deve retornar v_table_id
    const def = JSON.stringify(data);
    if (def.includes('return v_table_id')) {
      console.log('✅ RETURN encontrado!');
    } else {
      console.log('❌ RETURN não encontrado! Isso pode ser o problema.');
    }
  } else {
    console.log('❌ Função não encontrada');
  }
}

checkFunction().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
