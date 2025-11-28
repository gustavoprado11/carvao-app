const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250405_add_unique_owner_constraint.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('⚠️  ATENÇÃO: Esta migration vai deletar tabelas duplicadas!');
  console.log('Será mantida apenas a mais recente de cada siderúrgica.\n');
  console.log('Aplicando constraint de unicidade...');

  const { error } = await supabase.rpc('execute_sql', { sql });

  if (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }

  console.log('✅ Constraint aplicado com sucesso!');
  console.log('\n📊 Verificando resultado...');

  const { data: tables } = await supabase
    .from('pricing_tables')
    .select('owner_email, company')
    .order('owner_email');

  if (tables) {
    console.log(`\nAgora existem ${tables.length} tabela(s):`);
    tables.forEach(t => console.log(`   - ${t.company} (${t.owner_email})`));
  }
}

run().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
