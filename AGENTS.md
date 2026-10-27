# AGENTS.md

Guia para qualquer agente de código neste repositório. O CLAUDE.md tem as regras completas.

## Leitura obrigatória antes de agir

1. CLAUDE.md
2. docs/CONTEXTO.md: domínio agronômico, perfis, fluxo e glossário
3. docs/PLANO.md: fases, entregas e critérios de pronto

## Estrutura

- src/app: rotas do Next.js por área (login, ensaios, coleta, aplicações, painel, relatórios, admin) e Route Handlers em src/app/api
- src/proxy.ts: bloqueio de páginas sem sessão ou sem perfil (Next.js 16)
- src/lib/data: camada única de acesso a dados, tipada
- src/lib/design: casualização, croqui e cronograma (funções puras e testadas)
- src/lib/offline: fila offline e sincronização
- src/components: componentes e formulários
- supabase/migrations: migrations SQL
- supabase/tests: testes de acesso por perfil (pgTAP)
- supabase/functions: Edge Functions (avisos, feed iCal, Microsoft Graph)
- tests/e2e, tests/perf, tests/security: testes de ponta a ponta, performance e segurança
- docs: contexto, plano, decisões e relatórios dos papéis
- .claude/agents: definição dos papéis
- .claude/skills: skills do projeto

## Papéis de agentes (padrão do projeto)

Cada tarefa passa pelos papéis abaixo, sempre como subagentes separados. Um papel não faz o trabalho de outro. A troca entre papéis é por documento em docs/, nunca por memória de conversa.

| Papel | Faz | Não faz | Entrega | Modelo
| analista | Lê o plano, detalha a tarefa, critérios de aceite e riscos | Não escreve código | docs/tarefas/NNN-nome.md | sonnet
| desenvolvedor | Implementa a tarefa com testes unitários | Não aprova o próprio trabalho | Código, migrations e testes | sonnet; opus para RLS, login e sincronização offline
| qa | Roda lint, tipos e todos os testes, escreve testes de ponta a ponta faltantes | Não corrige código de produção | docs/qa/NNN.md | haiku para rodar e relatar; sonnet para escrever testes
| performance | Mede build, tamanho do bundle, Lighthouse e consultas lentas | Não muda regra de negócio | docs/performance/NNN.md | sonnet
| seguranca | Revisa RLS, autenticação, segredos, dependências e OWASP | Não corrige; abre achados | docs/seguranca/NNN.md | opus

Fluxo de cada tarefa: analista, desenvolvedor, qa, performance e seguranca. Achado de qa, performance ou seguranca volta ao desenvolvedor. A tarefa só está pronta quando os três relatórios estão aprovados.

## Perfis de acesso do sistema

- coordination: cria ensaios, atribui perfis e ensaios, vê e edita tudo, corrige dados com motivo
- field: vê ensaios atribuídos, grava avaliações, aplicações e ocorrências, anexa fotos, corrige os próprios registros com motivo
- home_office: vê ensaios atribuídos, confere qualidade, gera relatórios, pede correção; não edita dado de campo

## Definição de pronto

Lint, tipos e testes passam; acesso testado por perfil; migration incluída quando há mudança de esquema; relatórios de qa, performance e seguranca aprovados; PLANO.md atualizado.

## Quando parar e perguntar

Regra agronômica ou estatística incerta, mudança de política de acesso, novo serviço pago, qualquer coisa com dados reais de contratantes.
