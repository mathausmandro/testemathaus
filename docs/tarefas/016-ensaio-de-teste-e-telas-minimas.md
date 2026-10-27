# 016 - Cadastro e visualização do ensaio de teste (telas mínimas)
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: sonnet

## Objetivo
Entregar o critério de pronto da Fase 1: cadastrar um ensaio de teste e provar na interface que cada perfil vê só o que deve, usando telas mínimas próprias, sem depender do protótipo do Lovable.

## Escopo
Inclui:
- Lista de ensaios (src/app/(app)/ensaios) mostrando só os que a pessoa pode ver, via src/lib/data.
- Formulário de criação de ensaio (só coordination) com validação zod no servidor: código, contratante, cultura, local, delineamento, datas previstas, responsável técnico.
- Página de detalhe do ensaio: identificação, membros atribuídos (somente leitura aqui; edição fica na 015) e, em modo leitura, a lista de tratamentos e parcelas do seed.
- Estados de carregamento, erro e vazio, em português do Brasil, acessíveis (rótulos, foco, contraste) e com layout responsivo para celular.
- Seed fictício de dois ensaios e usuários dos três perfis para demonstração local.
- Fluxo e2e por perfil.

Não inclui: cadastro completo do protocolo, casualização, croqui, cronograma (Fase 2), telas de coleta (Fase 3), visual final do protótipo (tarefa 020).

## Arquivos afetados
src/app/(app)/ensaios/*, src/components/*, src/lib/data/trials.ts, supabase/seed.sql, tests/e2e/*, tests/perf/*.

## Critérios de aceite
- [ ] coordination cria um ensaio de teste e ele aparece na lista.
- [ ] field e home_office atribuídos veem apenas os ensaios atribuídos; o ensaio não atribuído não aparece e a URL direta dele devolve não encontrado/negado.
- [ ] field e home_office não veem o botão de criar e, chamando a ação diretamente, são rejeitados.
- [ ] Usuário sem perfil não chega às páginas de ensaios (tarefa 014).
- [ ] Entradas inválidas (código vazio, datas incoerentes) mostram erro claro e não gravam.
- [ ] Layout utilizável em tela de celular e passa nos limiares de acessibilidade do Lighthouse definidos em 002.
- [ ] Nenhuma chamada ao Supabase fora de src/lib/data.

## Testes esperados
Unitários: formulário e validações. e2e: um fluxo por perfil (coordination, field, home_office, sem perfil). pgTAP: coberto em 005 a 010. Performance: Lighthouse nas telas de lista e detalhe. Segurança: acesso por URL direta (IDOR) a ensaio de outro, XSS em campos de texto.

## Riscos e dependências
- Depende de 006, 011, 014 e, para a atribuição de membros, de 015 (pode seguir em paralelo usando o seed).
- Não inventar regras agronômicas: campos e opções do delineamento seguem o plano; valores adicionais dependem das respostas do Mathaus.

## Dúvidas para o Mathaus
- Os campos do cadastro do ensaio estão completos para o piloto?
- Código do ensaio: há padrão de numeração (ex.: ano, sequência) que o sistema deve sugerir ou validar?

## Entrega (preenchido pelo desenvolvedor)

**Não executado: requer Docker/Supabase local** (pgTAP, `db reset`, e2e autenticado `tests/e2e/ensaios.spec.ts` e Lighthouse das telas logadas). Executado aqui: lint, typecheck, `npm test` (374 testes), `test:security` e `npm run verify` (pgTAP ignorada por falta do Supabase local).

### O que foi feito
- Correção prévia (commit próprio): o pgTAP 010 usava os ids de usuário `10000000-...-0001` a `0005` do seed; agora usa o prefixo `a1000000-`. Os pgTAP 005 a 009 e 015 já usavam prefixos próprios (05, 06, 07, 08, 09, 15); nenhum caso foi enfraquecido.
- Seed: já tinha dois ensaios fictícios (ENS-TESTE-01 com protocolo de 2 tratamentos e 4 parcelas; ENS-TESTE-02 sem protocolo) e os usuários dos três perfis; a tela marca todo código `ENS-TESTE-*` com o selo "Ensaio de teste · dados fictícios".
- `/ensaios`: lista (cartões, mobile-first) via `listTrials`; a RLS decide o que aparece. Estado vazio diferente para coordination e demais perfis. Botão "Novo ensaio" só para coordination.
- `/ensaios/novo`: só coordination (`exigirPerfilNaPagina(["coordination"])`, também no proxy via `PERFIS_POR_AREA`); formulário com Server Action `criarEnsaio` (`exigirPerfil` antes de ler o formulário, zod de `createTrialSchema`, código repetido vira erro no campo). Funciona sem JavaScript; único componente cliente além do `error.tsx`.
- `/ensaios/[id]`: identificação, equipe (somente leitura), tratamentos e parcelas (`src/lib/data/protocol.ts`, novo, 2 consultas sem N+1). Ensaio fora da RLS ou id malformado responde 404.
- Carregamento (Suspense), erro (`error.tsx`) e vazio, em pt-BR, com rótulos, `aria-*`, foco na mensagem de erro e tabelas com `caption`.
- Navegação: link "Ensaios" no layout logado.

### Arquivos
- Telas: `src/app/(app)/ensaios/page.tsx`, `componentes.tsx`, `actions.ts`, `error.tsx`, `novo/page.tsx`, `novo/formulario.tsx`, `[id]/page.tsx`; `src/app/(app)/layout.tsx`.
- Dados e regras: `src/lib/data/protocol.ts`, `src/lib/data/index.ts`, `src/lib/format.ts`, `src/lib/auth/routes.ts`.
- Banco/testes: `supabase/tests/010_matriz_de_acesso.test.sql`.
- Testes: `tests/unit/ensaios-actions.test.ts`, `tests/unit/ensaios-dados.test.ts`, `tests/unit/auth-routes.test.ts`, `tests/e2e/ensaios.spec.ts` (novo), `tests/e2e/admin.spec.ts` (passos de `/ensaios` habilitados), `tests/e2e/rotas-protegidas.spec.ts`.

### Como testar
1. Aqui: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:security`, `npm run verify`.
2. Com Docker: `npx supabase db reset`, `npx supabase test db` (010 sem colisão com o seed), `.env.local` com `AUTH_LOCAL_PASSWORD_LOGIN=true`, `npm run build`, `E2E_SUPABASE=true npx playwright test tests/e2e/ensaios.spec.ts tests/e2e/admin.spec.ts tests/e2e/perfis.spec.ts`.
3. Manual: entrar com `campo@exemplo.test` (vê só ENS-TESTE-01; `/ensaios/20000000-0000-4000-8000-000000000002` dá 404), `escritorio@exemplo.test` (igual) e `coordenacao@exemplo.test` (vê os dois e cria um ensaio).

### Pendências
- Lighthouse das telas logadas (orçamento: 200 KB de JS inicial, desempenho >= 0,85) não roda sem sessão; falta um modo autenticado no `tests/perf` (precisa do Supabase local). As páginas são Server Components; só o formulário e o `error.tsx` vão ao cliente.
- Itens da tarefa não incluídos por falta de definição: padrão de numeração do código do ensaio (sem validação de formato) e opções adicionais de delineamento.
