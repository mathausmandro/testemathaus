# 004 - Supabase local e variáveis de ambiente
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: sonnet

## Objetivo
Ter o banco local rodando com supabase start, configuração versionada, variáveis de ambiente documentadas e o app capaz de ler a URL e a chave publicável do Supabase local.

## Escopo
Inclui:
- supabase init e supabase/config.toml versionado (portas, nomes de projeto, e-mail local via Inbucket/Mailpit para desenvolvimento).
- Script que gera .env.local a partir das chaves do supabase start (ou instruções claras), sem nunca versionar o arquivo.
- Validação das variáveis de ambiente no servidor com zod (módulo único, por exemplo src/lib/env.ts): falha com mensagem clara se faltar variável; SUPABASE_SECRET_KEY só acessível em código de servidor.
- Teste que impede importar o módulo de segredos em código de cliente.
- supabase/seed.sql com estrutura pronta (conteúdo de dados fictícios entra nas tarefas de migrations).
- Atualização do pipeline (002) para que a etapa pgTAP passe a ser obrigatória.

Não inclui: tabelas (005 em diante), login (012), projetos de teste e produção na nuvem (018).

## Arquivos afetados
supabase/config.toml, supabase/seed.sql, src/lib/env.ts, .env.example, scripts/setup-local.*, docs/ambiente.md, ci.yml.

## Critérios de aceite
- [ ] supabase start sobe os serviços e supabase status mostra URL e chaves; supabase db reset roda sem erro.
- [ ] .env.local é gerado localmente e não aparece em git status.
- [ ] Remover uma variável obrigatória faz o app falhar na inicialização com mensagem em português ou clara.
- [ ] Busca no código e no bundle do cliente não encontra SUPABASE_SECRET_KEY nem o valor da chave secreta.
- [ ] Etapa pgTAP do npm run verify roda (mesmo sem testes ainda) e é obrigatória no CI.
- [ ] Acesso por perfil: não se aplica (sem tabelas); registrado.

## Testes esperados
Unitários: validação de env (completa, faltando, valor vazio). e2e: fumaça. pgTAP: executa suíte vazia sem erro. Performance: tempo de supabase start registrado. Segurança: varredura do bundle de cliente por segredo; gitleaks.

## Riscos e dependências
- Depende da 001 (Supabase CLI e Docker) e usa a 002 para o ajuste do pipeline.
- Portas locais podem conflitar com outros serviços.

## Dúvidas para o Mathaus
- Nenhuma.

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (orientação de 27/10/2026). `supabase init` rodou (não precisa de Docker).

### Arquivos alterados
- Novos: `supabase/config.toml`, `supabase/.gitignore`, `supabase/seed.sql`, `scripts/setup-local.mjs`, `src/lib/env.ts`, `src/lib/env.server.ts`, `tests/stubs/server-only.ts`, `tests/unit/env.test.ts`, `tests/unit/setup-local.test.ts`.
- Alterados: `scripts/verify.mjs` (config.toml; ignorada local, reprova no CI), `tests/unit/verify.test.ts`, `tests/unit/ci-workflow.test.ts`, `.github/workflows/ci.yml` (supabase start sem condição + exportação das NEXT_PUBLIC_*), `.env.example` (comentário; só nomes), `vitest.config.mts` (alias de server-only), `package.json` (zod, server-only), `docs/ambiente.md`, `docs/qualidade.md`, INDICE e PLANO.

### Como testar
- Aqui: `npm test` (env, setup-local, verify, workflow), `npm run verify` (pgTAP aparece ignorada).
- Com Docker (pendente): `npx supabase start`, `npx supabase db reset`, `node scripts/setup-local.mjs`, `git status` sem `.env.local`, `npx supabase status -o env` (conferir que os nomes API_URL/PUBLISHABLE_KEY/SECRET_KEY batem com o mapeamento; há fallback para ANON_KEY/SERVICE_ROLE_KEY), `npx supabase test db`.

### Desvios e observações
- A validação de env não roda na inicialização do app: com `next start` sem `.env.local` o e2e e o Lighthouse quebrariam, e ainda não há consumidor. `getPublicEnv()`/`getServerEnv()` falham com mensagem em português no primeiro uso; ligar na inicialização (instrumentation) fica para a tarefa 011/012. Critério "app falha na inicialização" fica parcial.
- Busca por SUPABASE_SECRET_KEY no bundle do cliente: coberta por teste estático (só `env.server.ts` a cita; `server-only`); varredura do bundle real pendente até haver consumidor.
- Acesso por perfil: não se aplica (sem tabelas). pgTAP: suíte vazia não executada (requer Docker). Tempo do `supabase start`: não medido.

### Correções pós-revisão final (28/10/2026, QA A1)

O desvio acima foi corrigido: o app agora falha na inicialização sem variável obrigatória.

- `src/instrumentation.ts` (novo): `register()` chama `validarAmbienteNaInicializacao` (`src/lib/env-startup.ts`, novo). Valida as públicas em qualquer runtime e, no `nodejs`, também as do servidor (`getServerEnv`). Em caso de falha, imprime em pt-BR só os nomes das variáveis e encerra com código 1.
- `next.config.ts`: no build de produção, a falta de `NEXT_PUBLIC_*` interrompe o build com mensagem clara. As variáveis são embutidas no build, então sem elas o resultado sairia quebrado. A config passou a ser exportada como função; `nextConfig` continua exportado para os testes.
- Valores fictícios só nos processos de teste: `scripts/env-ficticia.mjs` (novo) preenche apenas o que falta (ambiente e `.env*` que o Next carrega) com valores fictícios, não secretos e marcados. Usado em `scripts/verify.mjs` (etapas build, e2e e perf), `playwright.config.ts` (`webServer.env`), `tests/perf/run-lighthouse.mjs` e `npm run test:e2e` (`scripts/com-env-ficticia.mjs`). Nenhum `.env` versionado recebe esses valores.
- Testes: `tests/unit/env-startup.test.ts` (novo), `tests/security/cabecalhos.test.ts` (usa `nextConfig`).
- Como testar: sem `.env.local`, `npm run build` falha ("Build interrompido. Variáveis de ambiente inválidas: NEXT_PUBLIC_SUPABASE_URL não definida..."). Com `node scripts/com-env-ficticia.mjs npm run build`, o build passa. `next start` sem env encerra com "Falha na inicialização do servidor: ... SUPABASE_SECRET_KEY não definida". Com `node scripts/com-env-ficticia.mjs node node_modules/next/dist/bin/next start -p 3400`, o servidor sobe e `/login` responde 200. Tudo isso foi executado aqui. `npm run verify` OK: e2e com 25 passaram e 21 pulados; Lighthouse passou.
- Atenção: o compose `prod` e a Vercel passam a exigir `SUPABASE_SECRET_KEY` em tempo de execução, e a imagem Docker exige os `NEXT_PUBLIC_*` como ARG de build. Já era o esperado pela matriz de variáveis.
