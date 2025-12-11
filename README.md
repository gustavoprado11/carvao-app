# Carvão Connect

Aplicativo móvel (Expo + React Native) que conecta fornecedores de carvão às principais siderúrgicas, oferecendo uma experiência moderna inspirada em apps da Apple.

## Funcionalidades atuais
- Fluxo de autenticação com alternância entre login e cadastro para fornecedores e siderúrgicas.
- Feed inicial com ações rápidas (Menu).
- Visualização de tabelas de preço dinâmica conforme o perfil logado (Tabelas).
- Painel de conversas recentes com status por cor (Conversas).
- Design minimalista e responsivo com foco em tipografia limpa e cards suaves.

## Como executar
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```
2. Inicie o aplicativo em modo desenvolvimento:
   ```bash
   npm run start
   ```
3. Use o Expo Go (Android/iOS) ou emuladores para visualizar o app.

## Portal web (Next.js)
- O portal web fica em `web/` e reutiliza os mesmos serviços Supabase do app (perfis supplier/steel/admin, tabelas, documentos e conversas).
- Variáveis obrigatórias: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (as mesmas do mobile).
- Para rodar:
  ```bash
  cd web
  npm install
  npm run dev
  ```
- Rotas principais: `/portal/login` (autenticação), `/portal` (dashboard), `/portal/tabelas`, `/portal/documentos`, `/portal/conversas` e `/portal/admin` (aprovações).

## Segurança e operação

### Confirmação de e-mail
- Criamos `landing/confirmacao-email.html`, uma página simples que avisa o usuário que o e-mail foi confirmado e oferece um botão para voltar ao aplicativo (`carvaoconnect://app`).
- Hospede essa página junto com o restante do site/landing (por exemplo, `https://carvaoconnect.com.br/confirmacao-email.html`).
- No Supabase, acesse **Authentication → URL Configuration** e defina:
  - `Site URL`: a URL pública onde o restante do site fica hospedado;
  - `Redirect URLs`: inclua a URL de confirmação (`https://carvaoconnect.com.br/confirmacao-email.html`). Assim, ao tocar no link do e-mail, o usuário será levado a essa tela de sucesso em vez de uma página em branco.
- Se desejar abrir o app diretamente após a confirmação, mantenha o botão de deep link (`carvaoconnect://app`) atualizado conforme o esquema configurado no Expo (`app.json` → `scheme`).

### Gestão de credenciais
- O app consome apenas a `anon key` do Supabase em `src/lib/supabaseClient.ts`. Revise periodicamente o repositório para garantir que nenhuma `service_role` ou segredo sensível foi versionado (`rg "service_role" -n`).
- Para builds EAS, registre as chaves como secrets:
  ```bash
  eas secret:create --name SUPABASE_URL --value https://<project>.supabase.co
  eas secret:create --name SUPABASE_ANON_KEY --value <anon-key>
  ```
- A função Edge `delete-account` depende de `SUPABASE_SERVICE_ROLE_KEY`. Defina essa variável apenas no Dashboard (Project Settings → API) e como Secret na área de Functions; nunca commitá-la no código.
- Caso precise de configuração local, mantenha arquivos `.env.local` (ignorados pelo Git) e distribua um `.env.example` sem segredos reais.

### Monitoramento
- No Supabase Dashboard, configure observabilidade (Logs → Alerts) para:
  - Erros das funções Edge (`delete-account`);
  - Falhas frequentes de autenticação ou políticas RLS.
- Utilize `supabase functions logs delete-account` durante debugging para inspecionar chamados da função.
- Considere integrar uma solução de analytics/monitoramento no app (p. ex. Sentry, Firebase Analytics). Ao escolher um provedor, armazene as chaves via secrets (EAS/Supabase) e documente o fluxo.

## Próximos passos sugeridos
- Integrar autenticação real (Firebase Auth, Supabase ou back-end próprio).
- Construir API/serviço que alimente tabelas e conversas em tempo real.
- Adicionar onboarding guiado e telas vazias personalizadas.
- Implementar temas claro/escuro para adequar-se ao modo do sistema.
