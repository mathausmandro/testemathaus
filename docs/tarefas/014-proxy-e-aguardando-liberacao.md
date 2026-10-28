# 014 - proxy.ts, guarda de perfil e tela "Aguardando liberação"
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

> Parte não executada: requer Docker/Supabase local (e2e autenticado por perfil: tests/e2e/perfis.spec.ts).

## Objetivo
Bloquear páginas para quem não tem sessão ou perfil, renovar a sessão no servidor e revalidar sessão e perfil em Server Actions e Route Handlers, exibindo a tela "Aguardando liberação de acesso" para quem entrou sem perfil.

## Escopo
Inclui:
- src/proxy.ts (Next.js 16) que renova a sessão do Supabase, redireciona sem sessão para o login e, com sessão sem perfil, para a tela de aguardando liberação; rotas públicas explicitamente listadas (login, callback, ativos estáticos).
- Tela em src/app/(auth) "Aguardando liberação de acesso", em português do Brasil, com botão de sair e sem dados do sistema.
- Helper único de servidor (em src/lib/data ou src/lib/auth) para exigir sessão e perfil (e perfil específico) dentro de Server Actions e Route Handlers, retornando erro padronizado; esconder botão não é segurança.
- Layout das áreas logadas em src/app/(app) com navegação mínima própria conforme perfil (telas mínimas, independentes do protótipo).
- Garantir que respostas autenticadas não sejam cacheadas de forma compartilhada.

Não inclui: administração de perfis (015), páginas de negócio (016), hook de domínio (013).

## Arquivos afetados
src/proxy.ts, src/app/(auth)/aguardando/*, src/app/(app)/layout.tsx, src/lib/auth/* ou src/lib/data/*, tests/e2e/*, tests/security/*.

## Critérios de aceite
- [ ] Acesso a qualquer rota de src/app/(app) sem sessão redireciona para o login (e2e, para todas as rotas existentes).
- [ ] Usuário logado sem perfil só vê a tela de aguardando liberação; qualquer outra rota o redireciona para ela.
- [ ] Usuário com perfil acessa as áreas permitidas ao seu perfil; área de administração é negada a field e home_office no servidor (não apenas oculta).
- [ ] Server Actions e Route Handlers existentes rejeitam chamada sem sessão e sem perfil adequado (teste direto, sem passar pela tela).
- [ ] A rota do proxy não bloqueia ativos estáticos nem quebra o login; lista de exceções revisada.
- [ ] Cabeçalhos de cache impedem cache compartilhado de páginas autenticadas.
- [ ] Teste de segurança varre as rotas e confirma que nenhuma rota logada ficou fora do proxy.

## Testes esperados
Unitários: helper de exigir sessão e perfil; decisão de redirecionamento do proxy. e2e: um fluxo por situação (sem sessão, sem perfil, cada perfil). pgTAP: não se aplica. Performance: custo do proxy por requisição. Segurança: tentativa de acesso direto a rotas e a ações, bypass por caminho, cache de dados de outro usuário.

## Riscos e dependências
- Depende de 011 e 012. Risco alto: rota esquecida fora da proteção; cache de resposta de outro usuário; loop de redirecionamento.

## Dúvidas para o Mathaus
- Texto desejado para a tela de aguardando liberação e a quem a pessoa deve recorrer (contato da coordenação).

## Entrega (preenchido pelo desenvolvedor)

### Arquivos
- src/proxy.ts: renova a sessão (cookies do Supabase), decide e redireciona; respostas com `Cache-Control: private, no-store`; cookies renovados/apagados vão junto no redirecionamento. Matcher cobre tudo exceto `_next/static`, `_next/image`, favicon/robots/sitemap/manifest e imagens/fontes por extensão. `/` e `/auth/callback` seguem sem consultar a sessão (página inicial leve).
- src/lib/auth/routes.ts: decisões puras, **nega por padrão** (só `/`, `/login`, `/auth/callback` são públicas); anônimo → `/login?next=...`; sem perfil → `/aguardando`; com perfil em `/login` ou `/aguardando` → `/inicio`; `/admin` só coordination (`PERFIS_POR_AREA`); falha ao ler o perfil → `/login?erro=indisponivel` (nunca libera).
- src/lib/data/proxy-session.ts: cliente do proxy (getClaims + `profiles.role` do próprio id); sem variáveis → anônimo.
- src/lib/data/server/session.ts: `obterSessao` (connection() + getUser() + perfil; cache por requisição). src/lib/auth/guard.ts (`avaliarAcesso`, nomes dos perfis) e src/lib/auth/server.ts: `exigirSessao`/`exigirPerfil(perfis?)` (Server Actions e Route Handlers: DataError `unauthenticated`/`forbidden`), `exigirPerfilNaPagina(perfis?)` (login, aguardando ou 404), `exigirSessaoSemPerfilNaPagina`.
- src/app/(auth)/aguardando/page.tsx: "Aguardando liberação de acesso", botão Sair, nenhum dado do sistema.
- src/app/(app)/layout.tsx (navegação mínima por perfil + Sair), (app)/inicio/page.tsx (qualquer perfil), (app)/admin/page.tsx (só coordination; nada é exibido antes da checagem; conteúdo na 015). src/components/botao-sair.tsx. src/app/page.tsx ganhou o link "Entrar".
- lighthouserc.json: Lighthouse também em `/login` (a página inicial continua pública e sem redirecionamento). docs/ambiente.md e tests/perf/run-lighthouse.mjs atualizados.
- Testes: tests/unit/auth-routes (tabela de decisões, sem loop, sem destino externo), proxy (proxy + leitura da sessão, cookies e cabeçalhos), auth-server (helpers chamados direto, como numa Server Action), session; tests/security/rotas-protegidas.test.ts (varre src/app: matcher cobre toda página/handler, lista pública revisada, toda página de (app) chama `exigirPerfilNaPagina`, admin exige coordination, actions/handlers protegidos chamam `exigir*`, e2e lista todas as rotas, sessão lida em tempo de requisição); tests/e2e/rotas-protegidas.spec.ts (sem banco: redireciona ao login, rota desconhecida, next preservado, variações de caminho, estáticos acessíveis, cookie forjado); tests/e2e/perfis.spec.ts (requer Supabase: sem perfil, coordination, field, home_office, cache).

### Como testar
- Aqui: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:security`, `npm run verify` (tudo passou; pgTAP ignorada; Lighthouse em `/` e `/login`).
- Com Supabase local: `npx supabase db reset`; `.env.local` (setup-local) + `AUTH_LOCAL_PASSWORD_LOGIN=true`; `npm run build`; `E2E_SUPABASE=true npx playwright test`.

### Decisões e pontos para revisão
- Bug evitado: sem `connection()` em `obterSessao`, um build sem variáveis congelava o redirecionamento ao login nas páginas protegidas (rotas apareciam como estáticas). Coberto por teste.
- Páginas protegidas leem a sessão dentro de `<Suspense>` (exigência do Cache Components); o proxy redireciona antes, e o redirect/404 da página é a segunda barreira.
- Perfil sem permissão numa página recebe 404 (não revela a área); no proxy, volta ao início.
- O proxy usa `getClaims()` (valida o JWT; rede só se a chave de assinatura for simétrica) e uma consulta a `profiles` por requisição protegida. Custo a medir pelo papel performance.
- Ainda não há Server Actions/Route Handlers protegidos; o teste de segurança obriga os próximos a chamarem `exigirSessao`/`exigirPerfil`.

### Não executado
- e2e autenticado (tests/e2e/perfis.spec.ts e login-local.spec.ts) e cabeçalho de cache com sessão real: requerem Docker/Supabase.

### Correções pós-revisão final (28/10/2026, segurança M1)

- `src/lib/data/proxy-session.ts`: se o e-mail da sessão (claim `email`) estiver fora de `ALLOWED_EMAIL_DOMAIN`, o proxy encerra a sessão (`signOut({ scope: "local" })`) e trata o acesso como anônimo. O servidor faz a mesma conferência (tarefa 012), e assim não há laço de redirecionamento entre o proxy e as páginas. Testes: `tests/unit/proxy.test.ts`.
