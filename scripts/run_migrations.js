/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const migrations = [
  '20250401_add_audit_fields_pricing_tables.sql',
  '20250402_create_notifications_table.sql',
  '20250403_trigger_notify_admin_edit.sql',
  '20250404_update_persist_owner_audit.sql'
];

async function runMigration(filename) {
  const filePath = path.join(__dirname, '..', 'supabase', 'migrations', filename);
  console.log(`\nExecutando migration: ${filename}`);

  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ Arquivo não encontrado: ${filePath}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  const { error } = await supabase.rpc('execute_sql', { sql });

  if (error) {
    console.error(`  ❌ Falhou ao executar ${filename}:`, error);
    return false;
  }

  console.log(`  ✅ ${filename} executada com sucesso`);
  return true;
}

async function main() {
  console.log('🚀 Iniciando execução de migrations...\n');

  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (!success) {
      console.error('\n❌ Migration falhou. Abortando execução.');
      process.exit(1);
    }
  }

  console.log('\n✅ Todas as migrations foram executadas com sucesso!');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
