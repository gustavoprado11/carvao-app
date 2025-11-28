#!/usr/bin/env node
/**
 * Verifica se existem perfis com profile.id != auth.uid()
 * Isso pode causar problemas com RLS policies que esperam profile.id === auth.uid()
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyProfileIds() {
  console.log('🔍 Checking for profiles with mismatched IDs...\n');

  // Busca todos os perfis
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, type');

  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log('ℹ️  No profiles found in database');
    return;
  }

  console.log(`📊 Found ${profiles.length} profiles to verify\n`);

  const mismatches = [];

  for (const profile of profiles) {
    // Busca o usuário auth correspondente pelo email
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error(`❌ Error fetching auth users:`, authError);
      continue;
    }

    const authUser = authUsers.users.find(u => u.email?.toLowerCase() === profile.email.toLowerCase());

    if (!authUser) {
      console.log(`⚠️  Profile ${profile.email} has no corresponding auth user`);
      continue;
    }

    if (authUser.id !== profile.id) {
      mismatches.push({
        email: profile.email,
        type: profile.type,
        profileId: profile.id,
        authUid: authUser.id
      });
      console.log(`❌ MISMATCH: ${profile.email}`);
      console.log(`   Profile ID: ${profile.id}`);
      console.log(`   Auth UID:   ${authUser.id}\n`);
    } else {
      console.log(`✅ OK: ${profile.email}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SUMMARY:`);
  console.log(`   Total profiles: ${profiles.length}`);
  console.log(`   Mismatches: ${mismatches.length}`);
  console.log(`   Valid: ${profiles.length - mismatches.length}`);
  console.log(`${'='.repeat(60)}\n`);

  if (mismatches.length > 0) {
    console.log('⚠️  Found profiles with mismatched IDs!');
    console.log('⚠️  This will cause RLS policy violations when uploading documents.');
    console.log('\n💡 To fix this, you need to:');
    console.log('   1. Delete the profile records with wrong IDs');
    console.log('   2. Re-create them with correct IDs (auth.uid())');
    console.log('   3. Migrate any associated data (documents, etc.)\n');
  } else {
    console.log('✅ All profiles have matching IDs!');
  }
}

verifyProfileIds().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
