# 003 - Docker do app e docker compose
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: sonnet

## Objetivo
Rodar o app Next.js em container com perfis dev e prod, com imagem final enxuta e sem privilégio de administrador, seguindo a skill docker-local-env.

## Escopo
Inclui:
- Dockerfile em etapas: dependências, desenvolvimento, build e imagem final (usuário sem privilégio de administrador).
- output standalone no next.config.
- docker-compose.yml com perfis dev (com hot reload) e prod (imagem final).
- .dockerignore que exclui .env*, node_modules, .next, supabase/.temp e .git.
- Variáveis lidas de .env.local por env_file; nada de segredo copiado para a imagem.
- Teste que inspeciona a imagem final e confirma ausência de .env e de SUPABASE_SECRET_KEY.
- Seção em docs/ambiente.md com os comandos docker compose --profile dev up --build e --profile prod.

Não inclui: Supabase local (tarefa 004; o app em container o acessará via host.docker.internal ou rede configurada nela), publicação na Vercel, execução de testes de acesso no container (Fase 6).

## Arquivos afetados
Dockerfile, docker-compose.yml, .dockerignore, next.config.ts, docs/ambiente.md.

## Critérios de aceite
- [ ] docker compose --profile dev up --build sobe o app e a página inicial abre em localhost.
- [ ] docker compose --profile prod up --build sobe a imagem final e a página inicial abre.
- [ ] O processo na imagem final roda com usuário não administrador (docker exec whoami diferente de root).
- [ ] docker history e inspeção da imagem não revelam SUPABASE_SECRET_KEY nem arquivos .env.
- [ ] Alterar um arquivo no perfil dev recarrega a página sem rebuild.
- [ ] Tamanho da imagem final registrado em docs/ambiente.md.
- [ ] Acesso por perfil: não se aplica; registrado.

## Testes esperados
Unitários: não se aplica. e2e: fumaça Playwright contra o container prod. Performance: tamanho da imagem e tempo de build registrados. Segurança: verificação da imagem (usuário, ausência de segredos), gitleaks sobre o contexto.

## Riscos e dependências
- Depende da 001. Docker Desktop no Windows: sistema de arquivos lento para hot reload (pode exigir polling).
- Rede entre container e Supabase local precisa ser definida junto com a 004.

## Dúvidas para o Mathaus
- Nenhuma de domínio. Confirmar apenas se a TI permite Docker Desktop (ver 001).

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (orientação de 27/10/2026: docs/tarefas/ORIENTACAO-SEM-DOCKER.md).

### Arquivos alterados
- Novos: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `tests/unit/docker.test.ts`.
- Alterados: `next.config.ts` (`output: "standalone"`), `docs/ambiente.md` (seção "Docker do app"), `docs/tarefas/INDICE.md`.

### O que foi feito
- Dockerfile em 4 etapas (deps, dev, build, runner); `node:24-alpine`; `USER node` no dev e no runner; só NEXT_PUBLIC_* como ARG de build; nenhuma menção a SUPABASE_SECRET_KEY.
- Compose com perfis `dev` (volumes, polling para hot reload) e `prod` (imagem final, somente leitura, cap_drop ALL, no-new-privileges); `env_file: .env.local`; `host.docker.internal` via `extra_hosts`.
- `.dockerignore` exclui `.env*` (reabre só `.env.example`), node_modules, .next, supabase/.temp, .git, .docx.

### Como testar
- Sem Docker: `npm test` (inclui `tests/unit/docker.test.ts`, verificação estática do Dockerfile, compose e .dockerignore).
- Com Docker (pendente, parceiro): `docker compose --profile dev up --build` e `--profile prod up --build`, abrir http://localhost:3000; `docker compose run --rm app-prod whoami` (node); `docker history --no-trunc`; editar `src/app/page.tsx` no perfil dev e ver recarregar; registrar tamanho da imagem em docs/ambiente.md.

### Critérios de aceite
Todos os que dependem de container estão pendentes (requerem Docker). Acesso por perfil: não se aplica. O teste e2e de fumaça contra o container prod também ficou pendente.
