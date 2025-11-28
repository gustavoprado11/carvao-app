/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_ANON_KEY no .env');
}

// Usar anon key para simular chamada do app
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAdminSave() {
  console.log('🧪 Testando salvamento como admin...\n');

  // 1. Fazer login como admin
  console.log('1. Fazendo login como admin...');
  const adminEmail = 'gustavocostap11@gmail.com';

  // Você precisa fazer login primeiro
  console.log('   ⚠️  Este teste requer que você faça login manualmente no app');
  console.log('   📱 Por favor, teste diretamente no aplicativo');
  console.log('');
  console.log('   Verifique os logs no Metro/Expo para ver detalhes do erro');
  console.log('');
  console.log('💡 Dica: Os logs devem mostrar:');
  console.log('   - "[Admin] Chamando admin_upsert_pricing_table para: [email]"');
  console.log('   - Detalhes do erro em JSON se houver falha');
  console.log('');
  console.log('Se o erro ainda aparecer, pode ser:');
  console.log('   1. Siderúrgica selecionada não existe');
  console.log('   2. Email da siderúrgica está incorreto');
  console.log('   3. Problema de permissão no Supabase');
}

testAdminSave().catch(err => {
  console.error('❌ Erro:', err);
});
