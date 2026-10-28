# 019 - Onboarding de desenvolvedor em menos de 15 minutos
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: sonnet

## Objetivo
Garantir e medir que um desenvolvedor novo clona o projeto, preenche o .env.local e abre o sistema no navegador em menos de 15 minutos.

## Escopo
Inclui:
- README.md com passo a passo: pré-requisitos, clonar, npm ci, supabase start, gerar .env.local, supabase db reset, docker compose --profile dev up --build (ou npm run dev), usuários de teste e como rodar npm run verify.
- Script único de preparação (por exemplo npm run setup) que confere pré-requisitos, gera .env.local a partir do Supabase local e aplica as migrations e o seed.
- Medição cronometrada do passo a passo em ambiente limpo (máquina sem cache, tempo registrado em docs/ambiente.md, separando tempo de download de imagens).
- Seção de solução de problemas (portas ocupadas, Docker parado, WSL2).

Não inclui: instalação de Node, Git, Docker e Supabase CLI (feita na 001), configuração dos ambientes remotos (018).

## Arquivos afetados
README.md, scripts/setup.*, package.json, docs/ambiente.md.

## Critérios de aceite
- [ ] Seguindo apenas o README, em ambiente limpo, o sistema abre no navegador e o login local funciona em menos de 15 minutos (tempo medido e registrado).
- [ ] Rodar o script de setup duas vezes não quebra nada.
- [ ] O script nunca imprime nem grava chaves em arquivos versionados.
- [ ] npm run verify passa logo após o setup.
- [ ] Revisão por alguém que não escreveu o README (QA) confirma que os passos são claros.

## Testes esperados
Unitários: lógica do script, se houver. e2e: o e2e padrão contra o ambiente recém-preparado. pgTAP: executa no fim do setup. Performance: tempo total do setup. Segurança: gitleaks após o setup.

## Riscos e dependências
- Depende de 003, 004, 010 e 016 (sistema completo da fase). Tempo de download das imagens do Docker pode estourar os 15 minutos na primeira vez; definir como a meta é medida.

## Dúvidas para o Mathaus
- A meta de 15 minutos inclui o download inicial das imagens do Docker ou conta só depois dele?

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (medição dos 15 minutos, setup duas vezes, e2e no ambiente recém-preparado).

Arquivos: README.md (onboarding, login local, solução de problemas, seção Primeira validação no ambiente com Docker com modelo de docs/qa/validacao-docker.md), scripts/doctor.mjs (node >= 24, docker, supabase, portas, .env.local sem imprimir valores), tests/unit/doctor.test.ts, package.json (npm run doctor, npm run setup:local). O setup existente é scripts/setup-local.mjs (idempotente: não sobrescreve sem --force); não foi criado script único novo que chame supabase start/db reset, para evitar efeitos no banco sem confirmação.

Como testar: npm run doctor; npm test. Com Docker: seguir o README e registrar em docs/qa/validacao-docker.md e docs/ambiente.md.

### Correções pós-revisão final (28/10/2026, QA A3 e A6)

- `npm run setup` (`scripts/setup.mjs`, novo) roda em sequência: `doctor` (pré-requisitos; a falta do `.env.local` não bloqueia), `setup:local` (só se o `.env.local` ainda não existir) e as orientações dos próximos passos. Não roda nada destrutivo: não faz `db reset`, não usa `--force` e não mexe em containers. Testes: `tests/unit/setup.test.ts`.
- README: o passo a passo usa `npm run setup`, inclui a linha de `AUTH_LOCAL_PASSWORD_LOGIN=true` (A6) e avisa que o app não sobe sem as variáveis obrigatórias.
- Como testar aqui: `npm run setup` sem Docker para em "Pendências antes de continuar: Docker" (código 1), mostra as orientações e não cria o `.env.local` (executado).
