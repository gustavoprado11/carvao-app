/**
 * Script para verificar o status das siderúrgicas no banco de dados
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY devem estar definidos no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSteelStatus() {
  console.log('\n=== Verificando status das siderúrgicas ===\n');

  // Buscar todas as siderúrgicas
  const { data: allSteels, error: allError } = await supabase
    .from('profiles')
    .select('id, email, company, location, status, type')
    .eq('type', 'steel')
    .order('company');

  if (allError) {
    console.error('Erro ao buscar siderúrgicas:', allError);
    return;
  }

  console.log(`Total de siderúrgicas cadastradas: ${allSteels.length}\n`);

  // Agrupar por status
  const byStatus = {};
  allSteels.forEach(steel => {
    const status = steel.status || 'null';
    if (!byStatus[status]) {
      byStatus[status] = [];
    }
    byStatus[status].push(steel);
  });

  // Mostrar por status
  Object.keys(byStatus).sort().forEach(status => {
    console.log(`\n--- Status: ${status} (${byStatus[status].length}) ---`);
    byStatus[status].forEach(steel => {
      console.log(`  - ${steel.company || 'Sem nome'} (${steel.email})`);
      console.log(`    Localização: ${steel.location || 'Não informada'}`);
      console.log(`    ID: ${steel.id}`);
    });
  });

  // Verificar usando a RPC
  console.log('\n\n=== Testando RPC get_steel_profiles_by_status ===\n');

  const { data: approvedViaRPC, error: rpcError } = await supabase.rpc('get_steel_profiles_by_status', {
    target_status: 'approved'
  });

  if (rpcError) {
    console.error('Erro ao chamar RPC:', rpcError);
  } else {
    console.log(`Siderúrgicas aprovadas via RPC: ${approvedViaRPC?.length || 0}`);
    if (approvedViaRPC) {
      approvedViaRPC.forEach(steel => {
        console.log(`  - ${steel.company || 'Sem nome'} (${steel.email}) - status: ${steel.status}`);
      });
    }
  }

  console.log('\n');
}

checkSteelStatus().catch(console.error);
