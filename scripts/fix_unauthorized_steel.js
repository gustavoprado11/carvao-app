/**
 * Script para alterar o status de siderúrgicas não autorizadas de 'approved' para 'pending'
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

async function fixUnauthorizedSteel() {
  const emailToFix = 'marcosantoniopprado@gmail.com';

  console.log(`\n=== Corrigindo status de ${emailToFix} ===\n`);

  // Verificar status atual
  const { data: before, error: beforeError } = await supabase
    .from('profiles')
    .select('id, email, company, status, type')
    .ilike('email', emailToFix)
    .single();

  if (beforeError || !before) {
    console.error('Erro ao buscar perfil:', beforeError);
    return;
  }

  console.log('Status atual:', before.status);
  console.log('Tipo:', before.type);
  console.log('Empresa:', before.company);
  console.log('ID:', before.id);

  if (before.status === 'pending') {
    console.log('\n✓ O perfil já está com status "pending". Nenhuma alteração necessária.');
    return;
  }

  // Alterar para pending via RPC
  console.log('\nTentando atualizar status para "pending" via RPC update_steel_status...');

  const { data: rpcData, error: rpcError } = await supabase.rpc('update_steel_status', {
    target_id: before.id,
    new_status: 'pending'
  });

  if (rpcError) {
    console.error('\n✗ Erro ao usar RPC:', rpcError);
    console.log('\n⚠️  As políticas de segurança do banco impedem a alteração automática.');
    console.log('\n📋 SOLUÇÃO MANUAL:');
    console.log('1. Faça login como administrador no app');
    console.log('2. Acesse "Gestão de siderúrgicas"');
    console.log('3. Vá na aba "Aprovadas"');
    console.log('4. Localize: Siderúrgica Bandeirante (marcosantoniopprado@gmail.com)');
    console.log('5. Como não há função de "desaprovar", você precisará:');
    console.log('   - Acessar o painel do Supabase diretamente');
    console.log('   - Ir em Table Editor > profiles');
    console.log('   - Encontrar o registro com id:', before.id);
    console.log('   - Alterar o campo "status" de "approved" para "pending"');
    return;
  }

  if (!rpcData || rpcData.length === 0) {
    console.error('\n✗ RPC não retornou dados. Provável bloqueio de política RLS.');
    console.log('\n📋 SOLUÇÃO MANUAL: Acesse o painel do Supabase e altere diretamente.');
    return;
  }

  console.log('\n✓ Status atualizado via RPC!');
  console.log('Novo status:', rpcData[0].status);
  console.log('\nEssa siderúrgica agora precisa ser aprovada manualmente pelo administrador.');
}

fixUnauthorizedSteel().catch(console.error);
