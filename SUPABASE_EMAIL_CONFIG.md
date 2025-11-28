# Configuração de Email de Verificação - Supabase

Este guia explica como configurar o redirect URL para o email de verificação no Supabase, para que os usuários sejam direcionados para o app ao invés de verem a página de erro.

## 🎯 Objetivo

Quando um usuário clica no link de verificação de email, ele deve:
1. Ser redirecionado para o app mobile
2. Ver uma tela bonita de confirmação com sucesso
3. Poder continuar o cadastro facilmente

## 📱 Deep Link Configurado

O app está configurado com o scheme: `carvaoconnect://`

## ⚙️ Configuração no Supabase Dashboard

### Passo 1: Acessar as Configurações de Email

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Authentication** → **Email Templates**

### Passo 2: Editar o Template "Confirm signup"

1. Selecione o template **"Confirm signup"**
2. Localize a variável `{{ .ConfirmationURL }}`

### Passo 3: Configurar Redirect URL

**IMPORTANTE:** Para que o link de email funcione corretamente, você precisa configurar uma página web intermediária que redireciona para o app.

#### Opção 1: Hospedar a Página HTML (Recomendado)

1. Faça deploy do arquivo `public/email-confirmed.html` em um servidor web (Vercel, Netlify, GitHub Pages, etc.)
2. No Supabase Dashboard, vá em **Authentication** → **URL Configuration**
3. Configure os seguintes URLs:

   **Site URL:**
   ```
   https://seu-dominio.com/email-confirmed.html
   ```

   **Redirect URLs:**
   ```
   https://seu-dominio.com/email-confirmed.html
   carvaoconnect://email-confirmation
   carvaoconnect://auth/callback
   ```

4. A página HTML automaticamente redirecionará para o deep link do app

#### Opção 2: Deep Link Direto (Pode não funcionar em todos os navegadores)

1. Vá em **Authentication** → **URL Configuration**
2. Configure:

   **Site URL:**
   ```
   carvaoconnect://email-confirmation
   ```

   **Redirect URLs:**
   ```
   carvaoconnect://email-confirmation
   carvaoconnect://auth/callback
   ```

**Nota:** A Opção 1 é mais confiável porque alguns navegadores bloqueiam deep links diretos em emails.

### Passo 4: Template de Email Completo (Exemplo)

```html
<h2>Confirme seu e-mail</h2>

<p>Olá,</p>

<p>Obrigado por se cadastrar no Carvão Connect!</p>

<p>Para concluir seu cadastro e enviar sua DCF para análise, clique no botão abaixo para confirmar seu e-mail:</p>

<p>
  <a href="carvaoconnect://email-confirmation?token={{ .TokenHash }}&type=signup"
     style="background-color: #1E63F5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
    Confirmar E-mail
  </a>
</p>

<p>Se você não criou esta conta, pode ignorar este e-mail com segurança.</p>

<p>Atenciosamente,<br>Equipe Carvão Connect</p>
```

## 🧪 Teste da Configuração

### 1. Criar uma Nova Conta

1. No app, crie uma nova conta de fornecedor
2. Use um email que você tenha acesso

### 2. Verificar o Email

1. Acesse sua caixa de entrada
2. Procure pelo email de verificação
3. Clique no link de confirmação

### 3. Resultado Esperado

Você deve:
- Ser redirecionado para o app (não para o navegador)
- Ver a tela de confirmação com ícone de sucesso ✅
- Ver a mensagem "E-mail confirmado com sucesso!"
- Poder clicar em "Continuar cadastro" e voltar para o onboarding

## 🔧 Troubleshooting

### O link abre o navegador ao invés do app

**Problema**: Deep link não está funcionando no dispositivo.

**Solução**:
1. Verifique se o app está instalado no dispositivo
2. No Android, pode ser necessário configurar App Links
3. No iOS, verifique se o Universal Links está configurado

### A tela de confirmação não aparece

**Problema**: Deep link não está sendo detectado corretamente.

**Solução**:
1. Verifique os logs do console: `[App] Deep link received: ...`
2. Certifique-se que a URL contém `type=signup` ou `email-confirmation`
3. Teste com: `npx uri-scheme open carvaoconnect://email-confirmation --ios`

### Email não é marcado como confirmado

**Problema**: Token inválido ou expirado.

**Solução**:
1. Use o botão "Reenviar e-mail" na tela de onboarding
2. Verifique se o token hash está sendo passado corretamente
3. Teste a confirmação manualmente no Supabase Dashboard

## 📚 Recursos Adicionais

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Deep Linking in React Native](https://reactnavigation.org/docs/deep-linking/)
- [Expo Linking API](https://docs.expo.dev/versions/latest/sdk/linking/)

## ✅ Checklist de Validação

- [ ] Template de email atualizado no Supabase
- [ ] Deep link configurado no app (`carvaoconnect://`)
- [ ] Redirect URLs adicionados nas configurações do Supabase
- [ ] Teste completo realizado (criar conta → verificar email → ver tela de sucesso)
- [ ] Usuário consegue continuar o onboarding após verificação
