/**
 * Script para normalizar os nomes dos documentos no banco de dados
 *
 * Este script irá:
 * 1. Buscar todos os documentos não-extras
 * 2. Atualizar seus nomes para os títulos padrão baseado no type_id
 *
 * Execute com: node scripts/fix_document_names.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const DOCUMENT_TYPES = {
  'dcf': 'DCF',
  'dae': 'DAE (Taxa Florestal e Expediente)',
  'dae_receipt': 'Comprovante pagamento DAE',
  'car': 'CAR',
  'mapa': 'MAPA',
  'deed': 'Escritura do imóvel',
  'lease': 'Contrato de arrendamento'
};

async function fixDocumentNames() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Erro: variáveis de ambiente EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY não encontradas');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🔍 Buscando documentos no banco de dados...\n');

  // Busca todos os documentos não-extras
  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, type_id, name, owner_profile_id')
    .neq('type_id', 'extra');

  if (error) {
    console.error('❌ Erro ao buscar documentos:', error);
    process.exit(1);
  }

  if (!documents || documents.length === 0) {
    console.log('✅ Nenhum documento encontrado para normalizar.');
    return;
  }

  console.log(`📄 Encontrados ${documents.length} documentos para verificar.\n`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const doc of documents) {
    const typeId = doc.type_id.toLowerCase().trim();
    const expectedName = DOCUMENT_TYPES[typeId];

    if (!expectedName) {
      console.log(`⚠️  Documento ${doc.id} tem type_id desconhecido: ${doc.type_id}`);
      continue;
    }

    if (doc.name !== expectedName) {
      console.log(`🔧 Atualizando documento ${doc.id}:`);
      console.log(`   Type: ${typeId}`);
      console.log(`   De: "${doc.name}"`);
      console.log(`   Para: "${expectedName}"`);

      const { error: updateError } = await supabase
        .from('documents')
        .update({ name: expectedName })
        .eq('id', doc.id);

      if (updateError) {
        console.error(`   ❌ Erro ao atualizar: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Atualizado com sucesso\n`);
        updatedCount++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✨ Normalização concluída!`);
  console.log(`   📊 Total de documentos verificados: ${documents.length}`);
  console.log(`   ✅ Documentos atualizados: ${updatedCount}`);
  console.log(`   ⏭️  Documentos já corretos: ${documents.length - updatedCount - errorCount}`);
  if (errorCount > 0) {
    console.log(`   ❌ Erros: ${errorCount}`);
  }
  console.log('═══════════════════════════════════════\n');
}

fixDocumentNames().catch(console.error);
