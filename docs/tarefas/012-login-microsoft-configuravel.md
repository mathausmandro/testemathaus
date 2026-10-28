# 012 - Login com provedor Microsoft configurável e sessão por cookies
Fase: 1 | Status: pronta para validação (requer Docker/Supabase e Entra ID) | Modelo do desenvolvedor: opus

> Parte não executada: requer Docker/Supabase local (login real com usuário de teste, e2e autenticado) e registro no Entra ID pela TI (fluxo Microsoft real).

## Objetivo
Implementar o fluxo de login com sessão em cookies seguros (@supabase/ssr) funcionando localmente com o Supabase local, com o provedor Microsoft (Entra ID) configurável por variáveis de ambiente, sem fixar nenhum valor de tenant, cliente ou domínio, para que a configuração da TI entre depois sem mudar código.

## Escopo
Inclui:
- Configuração do provedor Azure/Microsoft em supabase/config.toml lendo client id, segredo, URL do tenant e endereço de retorno de variáveis de ambiente (nomes documentados em .env.example; sem valores).
- Página de login em src/app/(auth), em português do Brasil, com botão "Entrar com a conta Microsoft" que fica desabilitado, com aviso claro, quando o provedor não está configurado.
- Rota de callback (Route Handler) que troca o código por sessão e grava cookies seguros (HttpOnly, Secure fora do local, SameSite), com validação do parâmetro de retorno contra open redirect.
- Ação de sair (logout) que encerra a sessão e limpa cookies.
- Modo de login apenas para desenvolvimento local, por e-mail e senha de usuários de teste do seed, ativo somente quando a variável de ambiente do ambiente local o permite e nunca em produção; os e-mails e senhas de teste ficam no seed/exemplo, nunca no código de produção.
- Testes e2e do fluxo com usuário de teste local.

Não inclui: hook de domínio (013), proxy e tela de aguardando liberação (014), administração de perfis (015), registro do app no Entra ID (feito pela TI).

## Arquivos afetados
supabase/config.toml, .env.example, src/app/(auth)/login/*, src/app/auth/callback/route.ts, src/lib/data (sessão), tests/e2e/*.

## Critérios de aceite
- [ ] Com Supabase local, um usuário de teste consegue entrar, tem sessão em cookie e consegue sair.
- [ ] Sem as variáveis do Microsoft, a página mostra o botão desabilitado e a mensagem explicando; nada quebra.
- [ ] Com variáveis fictícias, a URL de autorização montada aponta para o provedor configurado (verificado sem fixar valores no código).
- [ ] Nenhum valor de tenant, domínio, client id ou segredo existe no código ou no repositório (gitleaks e busca).
- [ ] Parâmetro de retorno externo (https://outro-site) é rejeitado no callback.
- [ ] Cookies de sessão são HttpOnly e SameSite; em produção Secure.
- [ ] O modo de login local não está disponível quando o ambiente não é local (teste unitário da condição).
- [ ] Acesso por perfil: login não concede dados; usuário sem perfil, depois de logado, continua sem ler nada (RLS, coberto em 010).

## Testes esperados
Unitários: validação de redirecionamento, condição do modo local, leitura da configuração. e2e: login e logout com usuário de teste; página com provedor ausente. pgTAP: não se aplica. Performance: Lighthouse na página de login. Segurança: open redirect, cookies, ausência de segredo, enumeração de usuários.

## Riscos e dependências
- Depende de 004 e 005. Risco alto: modo de login local ativo em produção por engano; open redirect; sessão vazando em cache.
- O fluxo real com a Microsoft só poderá ser validado após o registro no Entra ID pela TI; esse teste fica pendente e registrado, não bloqueia a tarefa.

## Dúvidas para o Mathaus
- Quando a TI deve entregar o registro do aplicativo no Entra ID (tenant, client id, segredo e endereços de retorno local, teste e produção)?
- Alguma conta de teste Microsoft pode ser usada no ambiente de teste?

## Entrega (preenchido pelo desenvolvedor)

### Arquivos
- src/lib/auth/redirect.ts: `caminhoDeRetornoSeguro` (só caminho interno com prefixo da lista permitida; URL absoluta, `//host`, `/\host`, esquema e controle caem em `/inicio`).
- src/lib/auth/config.ts: leitura de `AUTH_MICROSOFT_ENABLED`, `AUTH_LOCAL_PASSWORD_LOGIN`, `SITE_URL`, `APP_ENV`; `loginLocalPermitido` (variável true + Supabase local + não Vercel preview/produção + não APP_ENV=production); mensagens fixas de erro.
- src/lib/data/auth.ts: `iniciarLoginMicrosoft` (provider azure, PKCE, skipBrowserRedirect), `trocarCodigoPorSessao`, `entrarComSenha` (zod, erro genérico), `sair`.
- src/lib/data/cookie-options.ts: cookies HttpOnly, SameSite=Lax, Secure em produção; cabeçalhos sem cache. src/lib/data/server/server-client.ts passa a usar essas opções e ganha `limparCookiesDaSessao`.
- src/app/(auth)/login: page.tsx (config lida por requisição dentro de Suspense), opcoes-de-login.tsx (apresentação), actions.ts (`entrarComMicrosoft`, `entrarComSenhaLocal`, revalidam a configuração no servidor). src/app/(auth)/actions.ts: `sairDaConta`.
- src/app/auth/callback/route.ts: troca de código, erro do provedor/hook com mensagem fixa, redirect 303 só para caminho interno, `Cache-Control: no-store`.
- supabase/config.toml: `[auth.external.azure]` lendo `env(...)` (client_id, secret, redirect_uri, url), `enabled = false`; `additional_redirect_urls` só com `/auth/callback` local (3000 e e2e 3100).
- supabase/seed.sql: senha fictícia para os 4 usuários de teste + `auth.identities` do provedor email.
- .env.example: nomes novos (sem valores). docs/auth-microsoft.md: fluxo, variáveis, passo a passo para a TI, configuração por ambiente.
- Testes: tests/unit/auth-redirect, auth-config (modo local, cookies), auth-data (URL de autorização com Supabase fictício, PKCE em cookie HttpOnly, sem enumeração), auth-callback (open redirect), auth-actions (POST direto às ações), login-page.test.tsx; tests/e2e/login.spec.ts (sem banco) e tests/e2e/login-local.spec.ts (requer Supabase; pula sem `E2E_SUPABASE=true`).

### Como testar
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:security`, `npm run build`, `npx playwright test` (passaram aqui; login-local pulado).
- Com Supabase local: `npx supabase db reset`; `.env.local` com `AUTH_LOCAL_PASSWORD_LOGIN=true`; `npm run build`; `E2E_SUPABASE=true npx playwright test tests/e2e/login-local.spec.ts`.

### Não executado
- Login real com usuário de teste no Supabase local e e2e autenticado (requer Docker/Supabase).
- Fluxo Microsoft real (requer registro no Entra ID). A sobrescrita `SUPABASE_AUTH_EXTERNAL_AZURE_ENABLED` da CLI não foi verificada (alternativa documentada).
- Lighthouse da página de login: ver tarefa 014 (lighthouserc).

### Observações para revisão
- Cookies HttpOnly fazem o cliente do navegador (`client/browser.ts`) não enxergar a sessão; realtime e fila offline precisarão de caminho próprio (fases 3 e 4).
- Mensagem de recusa do hook chega ao callback como `error`; a tela mostra uma mensagem fixa (não reflete a descrição).

### Correções pós-revisão final (28/10/2026)

- QA A4: o status desta tarefa foi alinhado com o INDICE: "pronta para validação (requer Docker/Supabase e Entra ID)".
- Segurança M1(b): o domínio do e-mail agora também é conferido na sessão, no servidor. `src/lib/auth/dominio.ts` (novo) usa a mesma regra do hook: exatamente um @, sem espaços e domínio igual a `ALLOWED_EMAIL_DOMAIN`. `src/lib/auth/server.ts` trata como sem sessão quem estiver fora do domínio, em páginas, Server Actions e na tela Aguardando. O padrão é seguro: sem `ALLOWED_EMAIL_DOMAIN`, ninguém entra, exceto `exemplo.test` com o login local permitido. Testes: `tests/unit/auth-dominio.test.ts` (novo) e `tests/unit/auth-server.test.ts`.
