# Guia de Deploy - Página de Confirmação de Email

## 🎯 Objetivo

Este guia mostra como fazer deploy da página `email-confirmed.html` para que o fluxo de verificação de email funcione corretamente.

## 📋 Pré-requisitos

- Conta no Vercel, Netlify ou GitHub Pages (gratuito)
- Acesso ao Supabase Dashboard do projeto

## 🚀 Opção 1: Deploy no Vercel (Recomendado)

### Passo 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Passo 2: Fazer Login

```bash
vercel login
```

### Passo 3: Deploy da Página

```bash
cd /Users/gustavoprado/App
vercel deploy public --prod
```

### Passo 4: Copiar a URL

O Vercel retornará uma URL como:
```
https://seu-projeto.vercel.app/email-confirmed.html
```

## 🚀 Opção 2: Deploy no Netlify

### Passo 1: Instalar Netlify CLI

```bash
npm install -g netlify-cli
```

### Passo 2: Fazer Login

```bash
netlify login
```

### Passo 3: Deploy da Página

```bash
cd /Users/gustavoprado/App
netlify deploy --dir=public --prod
```

### Passo 4: Copiar a URL

O Netlify retornará uma URL como:
```
https://seu-projeto.netlify.app/email-confirmed.html
```

## 🚀 Opção 3: GitHub Pages

### Passo 1: Criar Repositório para a Página

```bash
cd /Users/gustavoprado/App/public
git init
git add email-confirmed.html
git commit -m "Add email confirmation page"
```

### Passo 2: Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Crie um repositório chamado `carvao-connect-email`
3. Não inicialize com README

### Passo 3: Push para o GitHub

```bash
git remote add origin https://github.com/SEU_USUARIO/carvao-connect-email.git
git branch -M main
git push -u origin main
```

### Passo 4: Ativar GitHub Pages

1. Vá em **Settings** → **Pages**
2. Em **Source**, selecione `main` branch
3. Clique em **Save**

### Passo 5: Copiar a URL

A URL será:
```
https://SEU_USUARIO.github.io/carvao-connect-email/email-confirmed.html
```

## ⚙️ Configuração no Supabase

### Passo 1: Acessar URL Configuration

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Authentication** → **URL Configuration**

### Passo 2: Configurar Site URL

Cole a URL da página que você fez deploy:

```
https://seu-dominio.vercel.app/email-confirmed.html
```

### Passo 3: Configurar Redirect URLs

Adicione as seguintes URLs (uma por linha):

```
https://seu-dominio.vercel.app/email-confirmed.html
carvaoconnect://email-confirmation
carvaoconnect://auth/callback
```

### Passo 4: Salvar

Clique em **Save** no final da página.

## 🧪 Testar o Fluxo Completo

### 1. Criar Nova Conta de Fornecedor

1. Abra o app
2. Faça logout se necessário
3. Clique em "Criar conta"
4. Preencha os dados com um email real que você tenha acesso
5. Crie a conta

### 2. Verificar Email

1. Acesse sua caixa de entrada
2. Procure por email de "Carvão Connect" ou seu projeto Supabase
3. Clique no link de confirmação

### 3. Resultado Esperado

Você deve ver:

✅ **Página de Sucesso** (no navegador)
- Ícone verde de check
- Mensagem "E-mail confirmado!"
- Texto "Redirecionando para o app..."

✅ **App Abre Automaticamente**
- Se estiver no mesmo dispositivo
- Mostra tela de confirmação com sucesso

✅ **No Onboarding (Passo 3)**
- Banner verde: "E-mail verificado com sucesso"
- Botão "Escolher arquivo DCF" habilitado
- Pode fazer upload da DCF normalmente

### 4. Testar Botão "Já verifiquei meu e-mail"

1. Após verificar o email, volte ao app
2. No passo 3 do onboarding, clique em "Já verifiquei meu e-mail"
3. Deve aparecer o banner verde de sucesso
4. Botão de upload deve ficar habilitado

## 🔧 Troubleshooting

### Problema: Página não redireciona para o app

**Solução 1**: Verifique se o app está instalado no dispositivo
- Em desenvolvimento, use Expo Go ou build de desenvolvimento
- Em produção, use build standalone

**Solução 2**: Teste o deep link manualmente
```bash
# iOS
npx uri-scheme open carvaoconnect://email-confirmation --ios

# Android
npx uri-scheme open carvaoconnect://email-confirmation --android
```

### Problema: Email ainda redireciona para localhost

**Causa**: Supabase ainda não foi configurado com a nova URL

**Solução**:
1. Verifique se salvou as configurações no Supabase Dashboard
2. Aguarde 1-2 minutos para as mudanças propagarem
3. Teste com um novo email de verificação (clique em "Reenviar email")

### Problema: "Já verifiquei meu e-mail" não funciona

**Causa**: Sessão não está ativa ou email ainda não foi verificado

**Solução**:
1. Verifique os logs do console no Metro bundler
2. Certifique-se de que clicou no link de verificação no email
3. Aguarde alguns segundos e tente novamente
4. Use "Reenviar email" se o link expirou (válido por 24h)

### Problema: Erro 404 ao acessar a URL deployada

**Causa**: Arquivo não foi deployado corretamente

**Solução Vercel**:
```bash
# Verificar arquivos deployados
vercel ls

# Re-deploy se necessário
vercel deploy public --prod --force
```

**Solução Netlify**:
```bash
# Re-deploy
netlify deploy --dir=public --prod
```

## 📱 URLs Configuradas

Depois de completar o setup, você terá:

| Tipo | URL | Propósito |
|------|-----|-----------|
| **Web** | `https://seu-dominio.vercel.app/email-confirmed.html` | Página intermediária que mostra sucesso |
| **Deep Link** | `carvaoconnect://email-confirmation` | Abre o app e mostra tela de confirmação |
| **Callback** | `carvaoconnect://auth/callback` | Callback alternativo para auth |

## ✅ Checklist Final

- [ ] Página `email-confirmed.html` deployada com sucesso
- [ ] URL da página acessível no navegador
- [ ] Site URL configurado no Supabase Dashboard
- [ ] Redirect URLs adicionados no Supabase Dashboard
- [ ] Configurações salvas no Supabase
- [ ] Teste completo realizado (signup → email → verificação → app)
- [ ] Botão "Já verifiquei meu e-mail" testado e funcionando
- [ ] Upload de DCF habilitado após verificação

## 🎉 Pronto!

Agora o fluxo de verificação de email está completo e profissional:

1. ✅ Usuário cria conta
2. ✅ Recebe email com link bonito
3. ✅ Clica no link e vê página de sucesso
4. ✅ É redirecionado automaticamente para o app
5. ✅ Vê confirmação no app
6. ✅ Pode continuar o cadastro e fazer upload da DCF

---

**Última atualização**: 2025-04-08
