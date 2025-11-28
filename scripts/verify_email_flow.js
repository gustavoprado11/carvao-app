#!/usr/bin/env node

/**
 * Script to verify email verification flow is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuração do fluxo de verificação de email...\n');

let hasErrors = false;

// 1. Check if email-confirmed.html exists
const htmlPath = path.join(__dirname, '..', 'public', 'email-confirmed.html');
if (fs.existsSync(htmlPath)) {
  console.log('✅ Arquivo email-confirmed.html existe');

  // Check if it contains the deep link
  const content = fs.readFileSync(htmlPath, 'utf8');
  if (content.includes('carvaoconnect://email-confirmation')) {
    console.log('✅ Deep link configurado corretamente no HTML');
  } else {
    console.log('❌ Deep link não encontrado no HTML');
    hasErrors = true;
  }
} else {
  console.log('❌ Arquivo email-confirmed.html NÃO encontrado');
  hasErrors = true;
}

// 2. Check if EmailConfirmationScreen exists
const screenPath = path.join(__dirname, '..', 'src', 'screens', 'EmailConfirmationScreen.tsx');
if (fs.existsSync(screenPath)) {
  console.log('✅ EmailConfirmationScreen.tsx existe');
} else {
  console.log('❌ EmailConfirmationScreen.tsx NÃO encontrado');
  hasErrors = true;
}

// 3. Check if App.tsx handles deep links
const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');

  if (appContent.includes('email-confirmation') || appContent.includes('type=signup')) {
    console.log('✅ App.tsx configurado para deep links de email');
  } else {
    console.log('❌ App.tsx NÃO está configurado para deep links de email');
    hasErrors = true;
  }

  if (appContent.includes('EmailConfirmationScreen')) {
    console.log('✅ App.tsx importa EmailConfirmationScreen');
  } else {
    console.log('❌ App.tsx NÃO importa EmailConfirmationScreen');
    hasErrors = true;
  }
} else {
  console.log('❌ App.tsx NÃO encontrado');
  hasErrors = true;
}

// 4. Check if SupplierOnboardingScreen uses getSession
const onboardingPath = path.join(__dirname, '..', 'src', 'screens', 'SupplierOnboardingScreen.tsx');
if (fs.existsSync(onboardingPath)) {
  const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');

  if (onboardingContent.includes('getSession()')) {
    console.log('✅ SupplierOnboardingScreen usa getSession() (correto)');
  } else if (onboardingContent.includes('getUser()') && onboardingContent.includes('checkEmailVerificationStatus')) {
    console.log('⚠️  SupplierOnboardingScreen ainda usa getUser() ao invés de getSession()');
    console.log('   Isso pode causar erro "Auth session missing"');
    hasErrors = true;
  } else {
    console.log('✅ SupplierOnboardingScreen configurado corretamente');
  }
} else {
  console.log('❌ SupplierOnboardingScreen.tsx NÃO encontrado');
  hasErrors = true;
}

// 5. Check app.json for deep link scheme
const appJsonPath = path.join(__dirname, '..', 'app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  if (appJson.expo?.scheme === 'carvaoconnect') {
    console.log('✅ Deep link scheme configurado em app.json');
  } else {
    console.log('❌ Deep link scheme NÃO configurado em app.json');
    hasErrors = true;
  }
} else {
  console.log('❌ app.json NÃO encontrado');
  hasErrors = true;
}

// 6. Check documentation files
const supabaseConfigPath = path.join(__dirname, '..', 'SUPABASE_EMAIL_CONFIG.md');
if (fs.existsSync(supabaseConfigPath)) {
  console.log('✅ SUPABASE_EMAIL_CONFIG.md existe');
} else {
  console.log('⚠️  SUPABASE_EMAIL_CONFIG.md não encontrado (documentação)');
}

const deployGuidePath = path.join(__dirname, '..', 'DEPLOY_EMAIL_PAGE.md');
if (fs.existsSync(deployGuidePath)) {
  console.log('✅ DEPLOY_EMAIL_PAGE.md existe');
} else {
  console.log('⚠️  DEPLOY_EMAIL_PAGE.md não encontrado (guia de deploy)');
}

console.log('\n' + '='.repeat(60));

if (hasErrors) {
  console.log('❌ ATENÇÃO: Alguns problemas foram encontrados!');
  console.log('\nPróximos passos:');
  console.log('1. Corrija os erros acima');
  console.log('2. Execute este script novamente para verificar');
  process.exit(1);
} else {
  console.log('✅ Todos os componentes do fluxo de email estão configurados!');
  console.log('\nPróximos passos:');
  console.log('1. Faça deploy da página email-confirmed.html');
  console.log('   Consulte DEPLOY_EMAIL_PAGE.md para instruções');
  console.log('2. Configure a URL no Supabase Dashboard');
  console.log('   Authentication → URL Configuration');
  console.log('3. Teste o fluxo completo criando uma nova conta');
  process.exit(0);
}
