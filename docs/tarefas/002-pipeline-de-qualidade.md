# 002 - Pipeline de qualidade, segurança e performance
Fase: 1 | Status: pronta (CI real pendente do repositório remoto) | Modelo do desenvolvedor: sonnet

## Objetivo
Criar um único comando local e um fluxo de CI que rodem, em ordem, lint, tipos, testes unitários, pgTAP, e2e, Lighthouse, npm audit e gitleaks, de modo que qualidade, segurança e performance sejam verificadas desde a Fase 1 e cada tarefa seguinte apenas acrescente seus testes.

## Escopo
Inclui:
- Script local npm run verify (ou equivalente) que executa as etapas na ordem: varredura de segredos (secretlint no local, gitleaks no CI), npm audit, lint, typecheck, test, pgTAP (supabase test db), build, test:e2e, test:perf (Lighthouse CI). Cada etapa mostra claramente passou ou falhou e o comando termina com código diferente de zero se qualquer uma falhar.
- Etapa de pgTAP que se comporta de forma explícita enquanto o Supabase local não existe: avisa "ignorada: Supabase local ausente" localmente, mas é obrigatória no CI depois da tarefa 004 (ficar documentado e com teste do comportamento).
- Workflow do GitHub Actions em .github/workflows/ci.yml com as mesmas etapas, cache do npm, Supabase CLI e Docker para pgTAP e e2e, publicação dos relatórios (Playwright, Lighthouse) como artefatos.
- Limiares de performance iniciais (Lighthouse: performance, acessibilidade, boas práticas) definidos em lighthouserc e registrados em docs/qualidade.md; limiar de npm audit: falhar em vulnerabilidade alta ou crítica.
- Documento docs/qualidade.md explicando como cada tarefa nova inclui seus testes no pipeline.

Não inclui: criação do repositório remoto, proteção de branch (decisão do Mathaus), implantação na Vercel (tarefa 018), testes de negócio.

## Arquivos afetados
package.json (scripts), scripts/verify.* , .github/workflows/ci.yml, lighthouserc.json, .gitleaks.toml, docs/qualidade.md.

## Critérios de aceite
- [ ] npm run verify passa de ponta a ponta no esqueleto da tarefa 001.
- [ ] Introduzir de propósito um erro de lint, um erro de tipo, um teste quebrado, um segredo falso e uma dependência vulnerável simulada faz a etapa correspondente falhar (cada caso verificado e revertido).
- [ ] O workflow de CI é válido (lint do YAML) e roda as mesmas etapas; falha em qualquer etapa reprova o job.
- [ ] Relatórios de Playwright e Lighthouse ficam disponíveis como artefatos do CI.
- [ ] A etapa de pgTAP é obrigatória no CI e fica documentada a regra de que não pode ser ignorada após a tarefa 004.
- [ ] Tempo total do verify no esqueleto registrado em docs/qualidade.md.
- [ ] Acesso por perfil: não se aplica (sem dados); CI não usa SUPABASE_SECRET_KEY real, só valores do Supabase local de teste.

## Testes esperados
Unitários: teste do script verify (ordem e código de saída), se for script próprio. e2e/pgTAP/performance: executados pelo próprio pipeline. Segurança: gitleaks e npm audit no pipeline; revisão de que secrets do CI não vazam em logs.

## Riscos e dependências
- Depende da 001. Etapas pgTAP, e2e autenticado e Lighthouse em páginas logadas só ganham conteúdo nas tarefas seguintes.
- Runners do GitHub Actions exigem repositório no GitHub; sem ele, vale só a versão local até o Mathaus decidir.
- Lighthouse em CI é variável; usar várias execuções e limiares realistas para não gerar falso negativo.

## Herdado da tarefa 001
- Performance: lighthouserc.json com asserções em error (performance >= 0,85, LCP <= 2500 ms, teto de JS inicial 200 KB), 3 execuções por URL. O esqueleto já usa 171 KB de JS inicial (docs/performance/001.md).
- Segurança S1: isolar @lhci/cli em pacote próprio com lockfile e npm ci --ignore-scripts, ou rodar só em job de CI sem segredos.
- Segurança S3 e S4: não excluir .env.example do secretlint e do gitleaks; atualizar a allowlist do .gitleaks.toml para o formato atual e não excluir package-lock.json.
- Segurança S5: test:security deve rodar os testes de tests/security.
- Segurança S7: avaliar o postinstall do pacote supabase (download de binário) no CI.

## Dúvidas para o Mathaus
- O CI será no GitHub Actions? (Depende do repositório remoto.)
- Qual nível mínimo de performance e acessibilidade aceitar nas telas de campo (sugestão inicial: 90 em ambos)?

## Decisões (27/10/2026)
- Mathaus aprovou: secretlint no local e gitleaks no CI.
- Workflow escrito para GitHub Actions; só roda quando o repositório remoto existir (ainda pendente).
- Limiares iniciais, até o Mathaus definir outros: performance 0,85 (orçamento do AGENTS), acessibilidade 0,90, boas práticas 0,90.

## Entrega (preenchido pelo desenvolvedor)

### Arquivos alterados (27/10/2026)
- Novos: scripts/verify.mjs, .github/workflows/ci.yml, docs/qualidade.md, tools/lhci/package.json e package-lock.json, tests/unit/verify.test.ts, tests/unit/ci-workflow.test.ts, tests/security/env-example.test.ts.
- Alterados: package.json e package-lock.json (script verify, test:security com tests/security, devDependency yaml para validar o workflow), lighthouserc.json, tests/perf/run-lighthouse.mjs (usa tools/lhci, flag --skip-build), .gitleaks.toml, .secretlintignore, .gitignore, vitest.config.mts, docs/ambiente.md, docs/PLANO.md, INDICE.

### Como testar
1. `npm ci --ignore-scripts` e `npm run verify`: 9 etapas, saída 0 (167 s; pgTAP "ignorada: Supabase local ausente").
2. `npm test` (verify, workflow e segurança) e `npm run test:security`.
3. `CI=true npm run verify`: deve reprovar na etapa pgTAP enquanto não houver Supabase local.
4. Detalhes, limiares e como acrescentar testes: docs/qualidade.md.

### Resultados
- verify de ponta a ponta: OK em 167 s. Lighthouse (3 execuções, asserções em error) passou.
- Falhas propositais, todas revertidas (git status idêntico ao inicial; package.json/lock restaurados): lint (verify parou, saída 1, etapas seguintes não executadas), tipo (2), teste (1), segredo falso em arquivo e em .env.example (1), lodash@4.17.20 só no lockfile (npm audit 1).
- Workflow: validado por teste Vitest com o pacote yaml (estrutura, permissions contents: read, actions por SHA, checksum do gitleaks, artefatos com always(), sem secrets). Não é actionlint: não foi validado por uma ferramenta específica de GitHub Actions.
- S1: @lhci/cli em tools/lhci, npm ci --ignore-scripts; npm audit da raiz não o cobre (16 avisos, 13 altos, exceção documentada). S3/S4: .env.example e package-lock.json varridos; allowlist em [[allowlists]]. S5: tests/security roda no test:security. S7: CLI Supabase 2.122 não tem postinstall; CI usa npm ci --ignore-scripts.

### Desvios e pendências
- Sem Docker/Supabase local e sem remoto: a etapa pgTAP real e o workflow não foram executados. gitleaks só roda no CI (não testado aqui; versão 8.30.1 e checksum vieram da release oficial).
- No CI, enquanto supabase/config.toml não existir (tarefa 004), o pgTAP reprova de propósito, conforme a regra pedida; o workflow ainda nem roda sem repositório remoto. Na 004 será preciso mapear as chaves do `supabase status` para NEXT_PUBLIC_* no workflow.
- verify usa `playwright test` e Lighthouse com --skip-build após a etapa build (evita 3 builds); test:e2e e test:perf continuam fazendo build quando rodados sozinhos.
- Dúvidas do Mathaus seguem abertas: confirmar GitHub Actions e nível mínimo nas telas de campo.

### Correções pós-revisão
- ci.yml: `include-hidden-files: true` no upload (o `.lighthouseci/` é oculto); playwright-report/ e test-results/ já enviados; nenhum caminho inclui `.env*`. tests/unit/ci-workflow.test.ts cobre os três pontos.
- G1: a allowlist padrão do gitleaks ignora o package-lock.json e não há forma confiável de removê-la sem o binário. Limitação documentada em .gitleaks.toml (comentário corrigido) e docs/qualidade.md; o secretlint cobre o lockfile localmente.
- docs/qualidade.md: medições do verify (167/194/217 s), divisão por etapa e recomendações de cache como pendência.
- G2 e G3 registrados na tarefa 017 (seção "Herdado da tarefa 002").
