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
| 8 | e2e | `playwright test` (usa o build da etapa 7) | todos passam |
| 9 | Performance | Lighthouse CI sobre o build (`tests/perf/run-lighthouse.mjs --skip-build`) | ver abaixo |

Os scripts avulsos continuam: `test:e2e` (faz o próprio build), `test:perf`, `test:security` (secretlint, audit e `vitest run tests/security`).

## pgTAP: regra de obrigatoriedade

- Local, sem Supabase local (sem Docker, hoje): a etapa mostra "ignorada: Supabase local ausente" com aviso e não reprova.
- No CI (`CI=true`): a ausência do Supabase local **reprova**. A etapa não pode ser ignorada. O workflow inicia o Supabase local quando `supabase/config.toml` existir; esse arquivo nasce na tarefa 004. Até lá, o CI fica vermelho nesta etapa de propósito (o workflow ainda nem roda sem repositório remoto).
- A partir da tarefa 004, ninguém pode marcar esta etapa como opcional, nem remover a falha por ausência.
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
- `.env.example` e `package-lock.json` são varridos de propósito (S3, S4). Só `node_modules/` e `.next/` ficam fora no gitleaks.
- O workflow usa `permissions: contents: read`, actions fixadas por SHA, nenhum `secrets.*` e nenhuma `SUPABASE_SECRET_KEY`; no CI só valem valores do Supabase local de teste.
- Relatórios (Playwright, resultados e Lighthouse) são publicados como artefato mesmo com falha.
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
