# Login Microsoft (Entra ID) e sessão

Tarefas 012 (login e sessão), 013 (hook de domínio) e 014 (proxy e aguardando liberação).
Situação: código pronto; **registro do aplicativo no Entra ID pendente da TI**. O fluxo real com a
Microsoft não foi executado (requer o registro e o Supabase local com Docker).

Nenhum valor de tenant, client id, segredo ou domínio fica no código ou no repositório. Tudo entra por
variável de ambiente (local) ou pelo painel do Supabase (teste e produção).

## Como funciona

1. A tela `/login` mostra "Entrar com a conta Microsoft". O botão só fica habilitado com
   `AUTH_MICROSOFT_ENABLED=true` no servidor do app; sem isso aparece o aviso de que o login ainda não
   está configurado.
2. O botão chama a Server Action `entrarComMicrosoft`, que pede ao Supabase Auth a URL de autorização do
   provedor `azure` com PKCE. O verificador do PKCE fica em cookie HttpOnly.
3. O Supabase Auth leva a pessoa ao tenant configurado (tenant único) e recebe o retorno em
   `<SUPABASE>/auth/v1/callback`.
4. No primeiro login, antes de criar o usuário, o Before User Created Hook (013) confere o domínio do e-mail.
   Fora do domínio: cadastro recusado e nenhum usuário nem perfil é criado.
5. O Supabase devolve para `/auth/callback?code=...&next=...` do app. A rota troca o código por sessão
   (cookies) e redireciona para `next`, que só pode ser um caminho interno de uma lista permitida
   (`src/lib/auth/redirect.ts`): URL absoluta, `//host` e afins caem em `/inicio`.
6. O proxy (014) renova a sessão e manda quem não tem perfil para "Aguardando liberação". A coordenação
   atribui o perfil (015).

## Cookies de sessão

- HttpOnly, SameSite=Lax, path `/`; Secure com `NODE_ENV=production` (navegadores aceitam Secure em
  `http://localhost`). Lax é necessário para o retorno do provedor; Strict quebraria o callback.
- Consequência: o cliente Supabase do navegador não enxerga a sessão. Todo acesso autenticado passa pelo
  servidor. Realtime e fila offline (fases 3 e 4) precisarão de um caminho próprio.
- Respostas com sessão saem com `Cache-Control: private, no-store`.

## Variáveis

App (servidor; nenhuma é `NEXT_PUBLIC`):

| Variável | Uso |
| --- | --- |
| `AUTH_MICROSOFT_ENABLED` | `true` quando o provedor estiver configurado no Supabase Auth do ambiente |
| `AUTH_LOCAL_PASSWORD_LOGIN` | `true` só na máquina local: login por senha dos usuários de teste do seed |
| `SITE_URL` | origem pública do site (opcional; sem ela usa a origem da requisição) |
| `APP_ENV` | `production` em produção (desliga o login local também fora da Vercel) |

CLI do Supabase (lidas por `supabase/config.toml`, seção `[auth.external.azure]`; exporte no shell ou
use `supabase/.env`, que o `.gitignore` já exclui):

| Variável | Valor (vem da TI) |
| --- | --- |
| `SUPABASE_AUTH_EXTERNAL_AZURE_ENABLED` | `true` para ligar o provedor localmente (ver nota abaixo) |
| `SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID` | ID do aplicativo (cliente) |
| `SUPABASE_AUTH_EXTERNAL_AZURE_SECRET` | valor do segredo do cliente |
| `SUPABASE_AUTH_EXTERNAL_AZURE_URL` | `https://login.microsoftonline.com/<id-do-tenant>/v2.0` |
| `SUPABASE_AUTH_EXTERNAL_AZURE_REDIRECT_URI` | `http://127.0.0.1:54321/auth/v1/callback` (local) |

Nota: `enabled` fica `false` no `config.toml` para o `supabase start` funcionar sem as variáveis (a CLI
recusa provedor ligado sem client id). A sobrescrita por `SUPABASE_AUTH_EXTERNAL_AZURE_ENABLED=true`
segue a convenção da CLI, mas **não foi verificada aqui**. Se não funcionar, troque para `true` só na
sua cópia local, sem comitar.

## Modo de login local (somente desenvolvimento)

Formulário de e-mail e senha para os usuários fictícios do seed (`coordenacao@`, `campo@`, `escritorio@`
e `aguardando@exemplo.test`, senha fictícia em `supabase/seed.sql`). Só aparece e só funciona com as três
condições: `AUTH_LOCAL_PASSWORD_LOGIN=true`, `NEXT_PUBLIC_SUPABASE_URL` local (localhost, 127.0.0.1 ou
host.docker.internal) e `VERCEL_ENV` diferente de `preview`/`production` e `APP_ENV` diferente de
`production`. A Server Action recusa o POST direto quando as condições não valem
(`src/lib/auth/config.ts`, testado em `tests/unit/auth-config.test.ts`).

## Passo a passo para a TI (registro no Entra ID)

1. Portal do Azure > Microsoft Entra ID > Registros de aplicativo > Novo registro.
2. Nome: Plataforma de Ensaios (um registro por ambiente, ou um só com vários endereços de retorno).
3. Tipos de conta: **somente contas deste diretório organizacional (tenant único)**.
4. URI de redirecionamento (Web): o callback do Supabase Auth de cada ambiente:
   - local: `http://127.0.0.1:54321/auth/v1/callback`
   - teste: `https://<ref-do-projeto-de-teste>.supabase.co/auth/v1/callback`
   - produção: `https://<ref-do-projeto-de-producao>.supabase.co/auth/v1/callback`
5. Certificados e segredos > Novo segredo do cliente. Anotar o **valor** (aparece uma vez) e a validade;
   combinar quem renova antes de expirar.
6. Permissões de API: Microsoft Graph delegadas `openid`, `profile`, `email`, `offline_access` (e
   `User.Read`, padrão). Conceder consentimento do administrador.
7. Configuração de token > Adicionar declaração opcional (ID token): `email` e `xms_edov` (indica que o
   domínio do e-mail foi verificado pelo tenant). Usada pelo hook da tarefa 013.
8. Entregar com segurança (cofre de senhas, nunca por e-mail ou chat): ID do tenant, ID do cliente,
   valor do segredo e validade.

## Configuração por ambiente

- Local: variáveis da CLI acima, `npx supabase stop` e `npx supabase start`; no `.env.local` do app,
  `AUTH_MICROSOFT_ENABLED=true`.
- Teste e produção (tarefa 018): painel do Supabase > Authentication > Providers > Azure: client id,
  segredo e "Azure Tenant URL" (`https://login.microsoftonline.com/<id-do-tenant>/v2.0`). Em
  Authentication > URL Configuration: Site URL do app e, em Redirect URLs, somente
  `https://<endereço-do-app>/auth/callback`. Na Vercel: `AUTH_MICROSOFT_ENABLED=true`,
  `SITE_URL` e `APP_ENV=production` (produção). `AUTH_LOCAL_PASSWORD_LOGIN` nunca é definida lá.

## Validação pendente (parceiro, com Docker)

1. `npx supabase db reset`, app com `.env.local` do `scripts/setup-local.mjs` e `AUTH_LOCAL_PASSWORD_LOGIN=true`.
2. `E2E_SUPABASE=true npx playwright test` (login local, cookies HttpOnly, logout, perfis).
3. Com o registro da TI: entrar com uma conta Microsoft do tenant; conta de outro tenant deve ser barrada
   pela Microsoft; conta do tenant com e-mail fora do domínio deve ser barrada pelo hook.
4. Conferir o caminho da claim `xms_edov` no evento do hook (ver docs/tarefas/013) e ajustar se necessário.
