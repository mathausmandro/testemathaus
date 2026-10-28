# Qualidade, segurança e performance

Pipeline único da tarefa 002. Local: `npm run verify`. CI: `.github/workflows/ci.yml` (GitHub Actions; só roda quando o repositório remoto existir, pendência do Mathaus).

## Etapas, em ordem

`scripts/verify.mjs` (Node, multiplataforma) roda as etapas abaixo, mostra PASSOU, FALHOU ou IGNORADA em cada uma, para na primeira falha e sai com código diferente de zero se alguma falhar. Ordem e código de saída têm teste em `tests/unit/verify.test.ts`.

| # | Etapa | Comando | Limiar |
| --- | --- | --- | --- |
| 1 | Segredos | `secretlint "**/*"` (local); gitleaks no CI | qualquer achado reprova |
| 2 | Dependências | `npm audit --audit-level=high` | alta ou crítica reprova |
| 3 | Lint | `npm run lint` | sem erros |
| 4 | Tipos | `npm run typecheck` | sem erros |
| 5 | Unitários | `npm test` (inclui `tests/unit`, `tests/security`, `src`) | todos passam |
| 6 | pgTAP | `supabase test db` | ver regra abaixo |
| 7 | Build | `npm run build` | sem erro |
| 8 | Segurança | `npm run test:security` (tarefa 017: secretlint, audit, gitleaks no histórico, `tests/security` com varredura do bundle do build da etapa 7) | qualquer falha reprova; gitleaks obrigatório no CI |
| 9 | e2e | `playwright test` (usa o build da etapa 7) | todos passam |
| 10 | Performance | Lighthouse CI sobre o build (`tests/perf/run-lighthouse.mjs --skip-build`) | ver abaixo |

Os scripts avulsos continuam: `test:e2e` (faz o próprio build), `test:perf`, `test:security` (`scripts/test-security.mjs`: secretlint, audit, gitleaks quando instalado, build se faltar e `vitest run tests/security`; detalhes em docs/seguranca/base.md).

## pgTAP: regra de obrigatoriedade

- Local, com `config.toml` mas sem o Supabase rodando (sem Docker, hoje), ou sem `config.toml`: a etapa mostra "ignorada: Supabase local ausente" com aviso e não reprova. Não executado: o pgTAP real requer Docker/Supabase local.
- No CI (`CI=true`): a ausência do Supabase local (ou de `supabase/config.toml`) **reprova**. A etapa não pode ser ignorada. O workflow roda `supabase start` sem condição e exporta as `NEXT_PUBLIC_*` com `node scripts/setup-local.mjs --github-env` (só chaves públicas do Supabase local de teste).
- Desde a tarefa 004, `supabase/config.toml` existe. Sem Docker, localmente a etapa fica "ignorada: Supabase local ausente"; ninguém pode marcar esta etapa como opcional no CI, nem remover a falha por ausência.
- Testado em `tests/unit/verify.test.ts`.

## Limiares de performance (lighthouserc.json)

Valores iniciais (decisão de 27/10/2026), mediana de 3 execuções, todos como `error`:

- Performance >= 0,85 (orçamento do AGENTS.md); acessibilidade >= 0,90; boas práticas >= 0,90.
- LCP <= 2500 ms.
- JS total da página <= 200 KB comprimido (`resource-summary:script:size` = 204800 bytes).

Linha de base do esqueleto: 171 KB de JS, performance perto de 0,85 e LCP 2,4 s (docs/performance/001.md): sem folga. Pendente com o Mathaus: nível mínimo para telas de campo (sugestão 90 em performance e acessibilidade). Ao criar telas de campo, acrescentar a URL em `collect.url`.

## Lighthouse isolado (S1)

`@lhci/cli` fica em `tools/lhci/` com `package.json` e `package-lock.json` próprios, instalado com `npm ci --ignore-scripts` (o `test:perf` instala sozinho se faltar). Nada de `npx --yes`.

Exceção documentada: o `npm audit` da raiz **não cobre** `tools/lhci/`, porque é outro pacote. Lá o audit aponta 16 avisos (13 altos) em dependências transitivas do `@lhci/cli` 0.15.1 (puppeteer, inquirer, zod, entre outras) sem correção compatível. O risco é aceito porque a ferramenta só roda em desenvolvimento e no CI, sem segredos, contra `localhost`, sem scripts de instalação, com versões fixas no lockfile. Reavaliar a cada atualização do `@lhci/cli` com `npm audit --prefix tools/lhci`.

## Segredos e CI

- Local: secretlint. CI: gitleaks 8.30.1, binário oficial baixado no runner com checksum SHA-256 fixo, varrendo o histórico (`gitleaks git`) e a árvore (`gitleaks dir`) com `--redact`.
- `.env.example` é varrido de propósito (S3). Só `node_modules/` e `.next/` ficam fora pela nossa allowlist.
- Limitação (G1): a allowlist padrão do gitleaks (`useDefault`) ignora lockfiles, então o `package-lock.json` **não** é varrido pelo gitleaks. Não há forma confiável de removê-la sem o binário para validar (não instalado aqui). O lockfile é coberto localmente pelo secretlint (etapa Segredos do verify) e pelo `npm audit`. Reavaliar ao atualizar o gitleaks.
- O workflow usa `permissions: contents: read`, actions fixadas por SHA, nenhum `secrets.*` e nenhuma `SUPABASE_SECRET_KEY`; no CI só valem valores do Supabase local de teste.
- Relatórios (Playwright, resultados e Lighthouse) são publicados como artefato mesmo com falha. `.lighthouseci/` é pasta oculta, por isso o passo usa `include-hidden-files: true`; nenhum caminho enviado inclui `.env*` (testado).
- S7: a CLI do Supabase 2.122 não tem script de instalação (o binário vem de pacote npm com integridade no lockfile). O CI usa `npm ci --ignore-scripts`; os únicos scripts do lockfile são de `fsevents` (só macOS) e `unrs-resolver` (fallback), dispensáveis.
- Teste de segurança S5: `tests/security/env-example.test.ts` (só nomes no `.env.example`, nenhum segredo em `NEXT_PUBLIC_*`).

## Como cada tarefa nova entra no pipeline

1. Testes unitários: `src/**/*.test.ts(x)` ou `tests/unit/`. Já rodam na etapa 5.
2. Segurança: `tests/security/*.test.ts`. Rodam na etapa 5 e em `npm run test:security`.
3. Banco: arquivos `.sql` pgTAP em `supabase/tests/`; rodam na etapa 6 (`supabase test db`). Toda tabela nova leva testes de acesso por perfil.
4. e2e: `tests/e2e/*.spec.ts`. Rodam na etapa 8.
5. Performance: URLs novas em `lighthouserc.json`; mudar um limiar exige registro aqui e decisão do Mathaus.
6. Nova etapa: editar `STEPS` em `scripts/verify.mjs`, ajustar o teste de ordem e o workflow.
7. Antes de entregar: `npm run verify` verde (pgTAP ignorada só até a 004).

## Verificação de falha proposital (tarefa 002)

Cada caso foi introduzido, a etapa correspondente falhou e tudo foi revertido (conferido com `git status`/`git diff`): erro de lint (verify parou na etapa Lint com saída 1 e marcou as seguintes como não executadas), erro de tipo (tsc saída 2), teste quebrado (vitest saída 1), segredo falso em arquivo e no `.env.example` (secretlint saída 1), dependência vulnerável simulada (`lodash@4.17.20` só no lockfile, `npm audit` saída 1).

## Tempo do verify no esqueleto

`npm run verify` no esqueleto (Windows 11, Node 24, instalação com `npm ci --ignore-scripts`, sem Docker): **167 s** (2 min 47 s) em 27/10/2026. Por etapa: segredos 4,5 s, audit 2,6 s, lint 10,8 s, tipos 9,3 s, unitários 14,4 s, pgTAP ignorada (Supabase local ausente), build 42,1 s, e2e 11,7 s, Lighthouse (3 execuções) 65,8 s. Em outra máquina ou no CI o tempo varia.

Medições do `npm run verify` (27/10/2026, mesma máquina): **167 s** (desenvolvedor), **194 s** (QA), **217 s** (performance); a variação entre execuções chega a 30%.

Divisão por etapa (performance, 217 s): segredos 7,8 s, audit 2,6 s, lint 45,4 s (atípico; 10,8 a 11,2 s nas outras medições), tipos 10,3 s, unitários 11,7 s, pgTAP ignorada 8,6 s (gasto só para descobrir que não há Supabase), build 18,6 s, e2e 14,3 s, Lighthouse 97,9 s (66 a 110 s). O Lighthouse é cerca de 45% do total.

### Pendência: cache e paralelização no CI (docs/performance/002.md)

Não implementado. Recomendações para quando o CI rodar de verdade:
1. Cache do Chromium do Playwright (`~/.cache/ms-playwright`, chave pelo hash do `package-lock.json`); com cache, rodar só `playwright install-deps chromium`.
2. Cache de `.next/cache` e de `tools/lhci/node_modules` (o workflow precisa de `npm ci --prefix tools/lhci --ignore-scripts`).
3. Separar lint, tipos e unitários em jobs paralelos ao build/e2e/Lighthouse.
4. Pular a tentativa do pgTAP no modo local quando `supabase/config.toml` não existe (poupa 8,6 s).
5. Se o Lighthouse reprovar de forma intermitente no runner, subir para 5 execuções ou descartar a fria antes de relaxar limiares.
