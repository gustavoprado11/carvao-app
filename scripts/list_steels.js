/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function listSteels() {
  console.log('📋 Listando siderúrgicas...\n');

  const { data: steels, error } = await supabase
    .from('profiles')
    .select('email, company, location, status, type')
    .eq('type', 'steel')
    .order('status', { ascending: false })
    .order('company');

  if (error) {
    console.error('❌ Erro ao buscar siderúrgicas:', error);
    return;
  }

  if (!steels || steels.length === 0) {
    console.log('⚠️  Nenhuma siderúrgica encontrada');
    return;
  }

  console.log(`Encontradas ${steels.length} siderúrgica(s):\n`);

  const approved = steels.filter(s => s.status === 'approved');
  const pending = steels.filter(s => s.status === 'pending' || !s.status);

  if (approved.length > 0) {
    console.log('✅ APROVADAS:');
    approved.forEach(steel => {
      console.log(`   - ${steel.company || 'Sem nome'}`);
      console.log(`     Email: ${steel.email}`);
      console.log(`     Localização: ${steel.location || 'Não informada'}`);
      console.log('');
    });
  }

  if (pending.length > 0) {
    console.log('⏳ PENDENTES:');
    pending.forEach(steel => {
      console.log(`   - ${steel.company || 'Sem nome'}`);
      console.log(`     Email: ${steel.email}`);
      console.log(`     Status: ${steel.status || 'não definido'}`);
      console.log('');
    });
  }

  // Verificar se têm tabelas
  console.log('\n📊 Verificando tabelas existentes...');
  const { data: tables, error: tablesError } = await supabase
    .from('pricing_tables')
    .select('owner_email, company, updated_at, last_modified_by, last_modified_by_type');

  if (!tablesError && tables) {
    console.log(`\nEncontradas ${tables.length} tabela(s):`);
    tables.forEach(table => {
      const owner = steels.find(s => s.email.toLowerCase() === table.owner_email.toLowerCase());
      console.log(`   - ${table.company || table.owner_email}`);
      console.log(`     Owner: ${table.owner_email}`);
      console.log(`     Última modificação: ${table.last_modified_by_type || 'N/A'} (${table.last_modified_by || 'N/A'})`);
      console.log(`     Status owner: ${owner?.status || 'não encontrado'}`);
      console.log('');
    });
  }
}

listSteels().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
