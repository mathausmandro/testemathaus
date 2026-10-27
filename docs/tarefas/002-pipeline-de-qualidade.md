# 002 - Pipeline de qualidade, segurança e performance
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: sonnet

## Objetivo
Criar um único comando local e um fluxo de CI que rodem, em ordem, lint, tipos, testes unitários, pgTAP, e2e, Lighthouse, npm audit e gitleaks, de modo que qualidade, segurança e performance sejam verificadas desde a Fase 1 e cada tarefa seguinte apenas acrescente seus testes.

## Escopo
Inclui:
- Script local npm run verify (ou equivalente) que executa as etapas na ordem: gitleaks, npm audit, lint, typecheck, test, pgTAP (supabase test db), build, test:e2e, test:perf (Lighthouse CI). Cada etapa mostra claramente passou ou falhou e o comando termina com código diferente de zero se qualquer uma falhar.
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

## Dúvidas para o Mathaus
- O CI será no GitHub Actions? (Depende do repositório remoto.)
- Qual nível mínimo de performance e acessibilidade aceitar nas telas de campo (sugestão inicial: 90 em ambos)?

## Entrega (preenchido pelo desenvolvedor)
