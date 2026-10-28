# Plataforma de Ensaios

Plataforma web para automatizar ensaios agronômicos: casualização, croqui, cronograma, fichas, coleta de campo (inclusive offline), conferência pelo home office e relatório técnico. Next.js 16 (App Router) + Supabase. Contexto completo em `CLAUDE.md`, `docs/CONTEXTO.md` e `docs/PLANO.md`.

## Onboarding do desenvolvedor (meta: menos de 15 minutos)

Status da medição: **não cronometrada ainda** (requer Docker). A meta conta depois do download inicial das imagens do Docker; registrar os dois tempos em `docs/ambiente.md` (decisão a confirmar com o Mathaus).

### Pré-requisitos

- Node.js 24 (LTS) e npm
- Git
- Docker Desktop (no Windows, com WSL2 ativo e virtualização habilitada)

Confira com `npm run doctor` (depois do `npm ci`): mostra versões, Docker em execução, portas livres e se o `.env.local` está completo, sem imprimir valores.

### Passo a passo

```
git clone <endereço-do-repositório>
cd plataforma-ensaios
npm ci
npx supabase start          # sobe o Supabase local (primeira vez baixa imagens)
npm run setup               # doctor + gera .env.local (setup:local) + próximos passos; nada destrutivo
npx supabase db reset       # aplica migrations e o seed (usuários fictícios); APAGA o banco local
# acrescente AUTH_LOCAL_PASSWORD_LOGIN=true ao .env.local para o login de teste (seção Login local)
npm run dev                 # http://localhost:3000
```

`npm run setup` encadeia `npm run doctor`, `npm run setup:local` (só se o `.env.local` ainda não existir) e mostra as orientações; não roda `db reset` nem sobrescreve nada. Rodar `npm run setup:local` de novo não sobrescreve o `.env.local` (use `-- --force` para recriar). O script nunca imprime chaves nem grava em arquivo versionado.

O app **não sobe sem as variáveis obrigatórias** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`): o build e a inicialização falham com mensagem em português. O e2e e o Lighthouse sem Supabase usam valores fictícios só do que faltar (`scripts/env-ficticia.mjs`).

Alternativa em containers: `docker compose --profile dev up --build` (ou `--profile prod`). Detalhes em `docs/ambiente.md`.

### Login local

Defina `AUTH_LOCAL_PASSWORD_LOGIN=true` no `.env.local` (só na sua máquina) e entre com os usuários fictícios do seed, senha `senha-teste-local`:

| Usuário | Perfil |
| --- | --- |
| `coordenacao@exemplo.test` | coordination |
| `campo@exemplo.test` | field |
| `escritorio@exemplo.test` | home_office |
| `aguardando@exemplo.test` | sem perfil (tela "Aguardando liberação") |

O login real é Microsoft (docs/auth-microsoft.md); o formulário local é ignorado fora do Supabase local e em produção.

### Verificar tudo

```
npm run verify
```

Roda segredos, audit, lint, tipos, testes, pgTAP, build, segurança, e2e e performance (docs/qualidade.md). Com o Supabase local rodando, a etapa pgTAP deixa de ser ignorada. Comandos avulsos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run test:security`, `npx supabase test db`.

### Solução de problemas

- **Docker parado ou não encontrado**: abra o Docker Desktop e espere o ícone ficar verde; confirme com `docker info`.
- **WSL2**: no Windows, o Docker Desktop precisa de WSL2 (`wsl --status`) e virtualização ligada na BIOS. Se falhar, peça apoio à TI.
- **Porta ocupada** (3000, 54321 a 54324): feche o processo que a usa ou altere `supabase/config.toml`. `npm run doctor` avisa as portas em uso (é normal se o Supabase já está rodando).
- **`.env.local` incompleto**: rode `npm run setup:local -- --force` com o Supabase local ligado.
- **Pouco espaço em disco**: mantenha pelo menos 2 GB livres.
- **Rede do container**: dentro do Docker use `http://host.docker.internal:54321` (docs/ambiente.md).

## Primeira validação no ambiente com Docker

Nada do que depende de Docker ou do banco foi executado ainda (decisão de 27/10/2026, `docs/tarefas/ORIENTACAO-SEM-DOCKER.md`). O parceiro desenvolvedor faz esta validação uma vez e registra o resultado em **`docs/qa/validacao-docker.md`** (crie o arquivo com o modelo abaixo; marque cada item com data, resultado e observações, e abra correções como tarefas novas).

1. Instalar Docker Desktop e Node 24; `npm ci`; `npm run doctor`.
2. `npx supabase start`, depois `npx supabase db reset` (migrations e seed).
3. `npx supabase test db` (pgTAP: matriz de acesso por perfil).
4. `npx supabase gen types typescript --local` e comparar com `src/lib/data/database.types.ts` (escrito à mão).
5. `docker compose --profile dev up --build` e `--profile prod` (imagem: usuário `node`, sem `.env`, sem `SUPABASE_SECRET_KEY`; ver `docs/ambiente.md`).
6. `npm run verify` com o Supabase local rodando.
7. Cronometrar o onboarding completo (com e sem download de imagens) e registrar em `docs/ambiente.md`.

Modelo para `docs/qa/validacao-docker.md`:

```
# Validação com Docker (data, pessoa, máquina)
| Item | Resultado (ok/falhou) | Observações |
| --- | --- | --- |
| supabase start | | tempo: |
| db reset | | |
| supabase test db | | |
| gen types x database.types.ts | | diferenças: |
| docker compose dev | | |
| docker compose prod | | tamanho da imagem: |
| npm run verify | | |
| onboarding cronometrado | | com download: / sem download: |
```

## Ambientes de teste e produção

Runbook em `docs/ambientes.md` (Vercel, projetos Supabase, variáveis por ambiente, backup, checklist de go-live).

## Regras que não mudam

Segurança fica no banco (RLS); `SUPABASE_SECRET_KEY` só no servidor; `.env.local` nunca é versionado; interface em português do Brasil. Lista completa em `CLAUDE.md`.
