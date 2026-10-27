# Ambiente de desenvolvimento

Registro das versões usadas na tarefa 001 (máquina Windows 11, PowerShell 5.1).

## Ferramentas instaladas na máquina

| Ferramenta | Versão | Situação |
| --- | --- | --- |
| Node.js | 24.22.1 (LTS 24) | instalado |
| npm | 11.19.1 | instalado com o Node.js |
| Git | 2.56.0 (Git for Windows) | instalado |
| Docker Desktop | pendente | não instalado de propósito; depende da TI (licença, WSL2, virtualização). Necessário a partir da tarefa 003 |
| Supabase CLI | 2.122.0 | devDependency npm "supabase"; conferir com `npx supabase --version` |

## Dependências principais do projeto

| Pacote | Versão |
| --- | --- |
| Next.js | 16.4.3 (App Router, Turbopack) |
| React / React DOM | 19.3.0 |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |
| ESLint | ^9 (eslint-config-next 16.4.3) |
| Vitest | ^5.0.5 (jsdom, Testing Library) |
| Playwright | ^1.64.1 (somente Chromium) |
| Lighthouse CI (@lhci/cli) | 0.15.1, isolado em tools/lhci (lockfile próprio, `npm ci --ignore-scripts`) |
| secretlint | ^13.1.0 (preset recommend) |

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes unitários (Vitest) |
| `npm run test:e2e` | build e testes de ponta a ponta (Playwright, Chromium) na porta 3100 |
| `npm run test:perf` | build, sobe o servidor na porta 3200 e roda Lighthouse CI sobre a página inicial; relatórios em `.lighthouseci` (upload filesystem, nada sai da máquina) |
| `npm run test:security` | secretlint, `npm audit --audit-level=high` e testes de tests/security |
| `npm run verify` | pipeline completo (docs/qualidade.md) |

## Preparar uma máquina nova

1. Instalar Node.js LTS 24 e Git.
2. `npm ci`
3. `npx playwright install chromium`
4. Copiar `.env.example` para `.env.local` e preencher (nunca versionar).

## Decisões e observações

- gitleaks é binário e não foi instalado. Localmente a varredura de segredos usa secretlint. O arquivo `.gitleaks.toml` está pronto para o CI da tarefa 002, que pode trocar a varredura por gitleaks.
- `@lhci/cli` não está em devDependencies porque suas dependências transitivas (lighthouse, puppeteer-core, extract-zip, tmp, basic-ftp) têm avisos de severidade alta no `npm audit` sem correção disponível. Ele roda por `npx @lhci/cli@0.15.1`, fora da árvore auditada, usando o Chromium do Playwright via `CHROME_PATH`. Reavaliar quando houver versão corrigida.
- Disco: a máquina ficou com pouco espaço livre durante a instalação (falha ENOSPC). O cache do npm foi limpo. Manter pelo menos 2 GB livres para instalar dependências, Chromium e rodar o Lighthouse.
- O build usa fontes do sistema (sem Google Fonts) para não depender de rede.

## Pendências de ambiente

- Repositório remoto: aguardando decisão do Mathaus.
- O `chrome.exe` do Playwright não inicia nesta máquina (erro de configuração lado a lado do Windows); o Lighthouse usa o chrome-headless-shell do Playwright.
- Docker Desktop: depende da TI. Registrar a versão aqui quando instalado.

## Docker do app (tarefa 003)

Não executado: requer Docker/Supabase local. Escrito e validado estaticamente (`tests/unit/docker.test.ts`); a validação real fica para o parceiro (docs/tarefas/ORIENTACAO-SEM-DOCKER.md).

Arquivos: `Dockerfile` (etapas deps, dev, build, runner), `docker-compose.yml` (perfis dev e prod), `.dockerignore`, `output: "standalone"` em `next.config.ts`.

```
docker compose --profile dev up --build    # hot reload (polling), http://localhost:3000
docker compose --profile prod up --build   # imagem final, http://localhost:3000
```

- Variáveis: `.env.local` (copiado de `.env.example`) lido por `env_file` em tempo de execução. A imagem não contém `.env*` nem `SUPABASE_SECRET_KEY`. Só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` entram como argumento de build (valores públicos, embutidos no navegador).
- Supabase local no host: dentro do container use `http://host.docker.internal:54321` em `NEXT_PUBLIC_SUPABASE_URL` (mapeado por `extra_hosts`). No navegador do host o mesmo valor não resolve; o ajuste fino da rede fica para a validação com a tarefa 004.
- Perfil dev: o código vai por volume (`.:/app`), então o `.env.local` do host fica visível dentro do container de desenvolvimento (apenas local). `WATCHPACK_POLLING` compensa o sistema de arquivos do Docker Desktop no Windows.
- Perfil prod: usuário `node` (não root), sistema de arquivos somente leitura, `cap_drop: ALL`, `no-new-privileges`.
- Verificação da imagem (a fazer com Docker): `docker compose --profile prod build`, `docker run --rm <imagem> whoami` (esperado: node), `docker history --no-trunc <imagem>` e `docker run --rm <imagem> sh -c "ls -a; env"` sem `.env` nem `SUPABASE_SECRET_KEY`.
- Tamanho da imagem final e tempo de build: pendentes (registrar aqui após o primeiro build).
- `next start` (usado pelo e2e e pelo Lighthouse) continua funcionando com `output: "standalone"`; o servidor da imagem é `node server.js`.

## Supabase local e variáveis (tarefa 004)

Não executado: `supabase start`, `db reset` e `status` requerem Docker/Supabase local. Escrito e validado estaticamente; checklist em docs/tarefas/ORIENTACAO-SEM-DOCKER.md.

- `supabase/config.toml` criado com `npx supabase init` (padrões da CLI 2.122: API 54321, banco 54322, Studio 54323, e-mail de desenvolvimento 54324). Project id `plataforma-ensaios`. Sem segredos; só referências `env(...)` desativadas.
- `supabase/seed.sql` mínimo (`select 1;`), sem dado pessoal. Dados fictícios entram com as migrations.
- `node scripts/setup-local.mjs` (com o Supabase local rodando) gera `.env.local` mapeando `API_URL` e a chave publicável para `NEXT_PUBLIC_*` e a chave secreta local para `SUPABASE_SECRET_KEY`. Não imprime valores, não sobrescreve sem `--force`. `ALLOWED_EMAIL_DOMAIN` fica em branco (valor pendente).
- `src/lib/env.ts` (variáveis públicas, zod, seguro para cliente) e `src/lib/env.server.ts` (inclui `SUPABASE_SECRET_KEY`, protegido por `import "server-only"`). `getPublicEnv()` e `getServerEnv()` falham com `EnvError` em português se faltar variável ou estiver vazia. Ainda não são chamadas na inicialização do app (nenhum consumidor até as tarefas 011 e 012); quando o primeiro consumidor existir, a falha ocorre no primeiro uso.
- Portas ocupadas: ajuste em `supabase/config.toml` e use `host.docker.internal` conforme a seção do Docker.
- Tempo de `supabase start`: pendente (registrar aqui na validação).
