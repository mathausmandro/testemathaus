# Ambientes: local, teste e produção

Tarefa 018. Runbook para criar e operar os três ambientes. Não executado: requer contas da Vercel e do Supabase (ação do Mathaus). Nenhum id de projeto, URL, domínio ou chave real está neste repositório; os valores abaixo são marcadores `<entre-colchetes>`.

## Visão geral

| Ambiente | App | Banco | Quem usa |
| --- | --- | --- | --- |
| Local | `npm run dev` ou Docker (porta 3000) | Supabase local (Docker) | desenvolvimento |
| Teste (staging) | Vercel, prévias de PR e branch `main` como "Preview" | projeto Supabase de **teste** | QA, TI, validação |
| Produção | Vercel, ambiente "Production" | projeto Supabase de **produção** (plano pago, com backup) | equipe real |

Regras: teste e produção são projetos Supabase separados, com chaves e senhas distintas. Prévias da Vercel nunca recebem variáveis de produção.

## Matriz de variáveis

| Variável | Local | Teste (Vercel Preview) | Produção (Vercel Production) | Observação |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | gerada por `npm run setup:local` | projeto de teste | projeto de produção | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | gerada | chave publicável do teste | chave publicável da produção | pública |
| `SUPABASE_SECRET_KEY` | gerada (local) | chave secreta do teste | chave secreta da produção | **só servidor**, nunca `NEXT_PUBLIC`, nunca no repositório |
| `ALLOWED_EMAIL_DOMAIN` | vazia | domínio (valor pendente) | domínio (valor pendente) | só servidor e banco |
| `AUTH_MICROSOFT_ENABLED` | vazia | `true` quando o Entra ID existir | `true` quando o Entra ID existir | |
| `AUTH_LOCAL_PASSWORD_LOGIN` | `true` | **vazia** | **vazia** | login de teste do seed, só local |
| `SITE_URL` | vazia | endereço de teste | endereço de produção | opcional |
| `APP_ENV` | vazia | vazia | `production` | desliga login local mesmo fora da Vercel |
| `SUPABASE_AUTH_EXTERNAL_AZURE_*` | vazias (ou da TI) | no painel do Supabase de teste | no painel do Supabase de produção | lidas pela CLI/Auth, não pelo app |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF_*` | nunca | só no shell de quem aplica / secrets do GitHub (environment `teste`) | só no shell de quem aplica; **não** vão para o GitHub Actions | usadas por `scripts/db-remoto.mjs` |

Como a Vercel separa: ao cadastrar cada variável, marque **somente** o ambiente correspondente. Variáveis de produção: marcar apenas "Production", desmarcar "Preview" e "Development". Variáveis de teste: marcar apenas "Preview". Conferência obrigatória (checklist abaixo): abra uma prévia e confirme que ela aponta para o projeto de teste.

## 1. Criar o projeto Supabase de teste

1. No painel do Supabase, criar projeto "plataforma-ensaios-teste" na região definida pelo Mathaus (pendente). Anotar a senha do banco no gerenciador de senhas da empresa.
2. Copiar o *project ref* (código curto da URL do painel). Guardar fora do repositório.
3. No shell (PowerShell), sem gravar em arquivo versionado:
   ```
   $env:SUPABASE_ACCESS_TOKEN = "<token-pessoal-da-conta>"
   $env:SUPABASE_PROJECT_REF_TESTE = "<ref-do-teste>"
   $env:SUPABASE_DB_PASSWORD = "<senha-do-banco-de-teste>"
   npm run db:link:teste
   npm run db:push:teste
   ```
4. Seed não é aplicado em teste nem em produção (`db push` não roda `seed.sql`). Usuários fictícios ficam só no local.
5. Em Authentication: habilitar o provedor Azure (Microsoft) com os dados da TI (docs/auth-microsoft.md) e gravar o domínio: `ALLOWED_EMAIL_DOMAIN` e `npm run auth:domain` apontando para o teste.
6. **Barreira de domínio no projeto remoto** (achado M1; `supabase db push` não leva o `config.toml`, então nada disto vem sozinho). Siga a seção 1.1 abaixo antes de liberar o acesso a qualquer pessoa.
7. Atribuir o perfil `coordination` ao primeiro usuário (SQL Editor, conforme docs/auth-microsoft.md), depois a coordenação libera os demais pela tela.

### 1.1 Runbook: provedor e-mail/senha desligado e hook habilitado (teste e produção)

Todo projeto Supabase novo vem com o provedor **Email** ligado e cadastro aberto. Com a chave publicável (que é pública), qualquer pessoa chamaria `/auth/v1/signup`. Faça em **cada** projeto remoto (teste e produção):

1. **Desligar e-mail/senha.** Authentication > Sign In / Providers > Email: desmarcar "Enable Email provider" (login e cadastro). Em Authentication > Settings, deixar "Allow new users to sign up" ligado só se o provedor Azure precisar (o cadastro acontece no primeiro login Microsoft); "Allow anonymous sign-ins" e "Phone" desligados.
2. **Habilitar o hook.** Authentication > Hooks > "Before User Created": tipo Postgres, schema `public`, função `hook_before_user_created` (equivale a `pg-functions://postgres/public/hook_before_user_created`). Salvar e conferir que aparece como habilitado.
3. **Conferir a configuração do banco** (SQL Editor, só leitura):
   ```sql
   select allowed_email_domain is not null as dominio_gravado,
          local_test_mode, allow_non_azure_providers, require_verified_email_claim
   from app_private.auth_settings;
   ```
   Esperado: `dominio_gravado = true`, `local_test_mode = false`, `allow_non_azure_providers = false` (padrão da migration 20261028120000; só o seed local liga). `require_verified_email_claim`: ver o item 6.
4. **Testar o cadastro por senha** (deve ser recusado): com a URL e a chave publicável do projeto,
   ```
   curl -s -X POST "https://<ref>.supabase.co/auth/v1/signup" -H "apikey: <chave-publicavel>" -H "Content-Type: application/json" -d "{\"email\":\"teste@<dominio>\",\"password\":\"<senha-qualquer-longa>\"}"
   ```
   Esperado: erro (provedor desligado ou "Cadastro não permitido"). Repita com um e-mail de **outro domínio**: também recusado. Se algum criar usuário, apague-o em Authentication > Users e volte ao passo 1.
5. **Testar o login Microsoft** com uma conta da empresa (aceito) e, se a TI tiver, com uma conta de convidado ou de outro domínio no tenant (recusado).
6. **B1: exigir `xms_edov` (bloqueio de go-live).** Depois que a TI emitir a claim opcional `xms_edov` no registro do app (docs/auth-microsoft.md), confirmar no primeiro login real onde ela chega (`raw_user_meta_data` do usuário) e ligar:
   ```sql
   update app_private.auth_settings set require_verified_email_claim = true, updated_at = now();
   ```
   Sem isso, um atributo `mail` não verificado no tenant passaria no hook. **A produção não entra no ar com `require_verified_email_claim = false`.**
7. **Segunda barreira no app.** `ALLOWED_EMAIL_DOMAIN` precisa estar definida na Vercel (Preview e Production). Sem ela, o app recusa **toda** sessão (src/lib/auth/dominio.ts) e o proxy encerra a sessão de quem estiver fora do domínio.

## 2. Criar o projeto Supabase de produção

Mesmos passos, com projeto "plataforma-ensaios-producao", **plano pago** (necessário para backup diário e restauração por ponto no tempo). Use `SUPABASE_PROJECT_REF_PRODUCAO` e, para aplicar:

```
npm run db:push:producao -- --dry-run     # mostra o que seria aplicado
npm run db:push:producao                  # aplica; exige a confirmação embutida
```

Aplicar em produção só depois de a mesma migration ter passado no teste. Antes do push de produção, vincule a pasta à produção com `npm run db:link:producao` (exige a mesma confirmação). A CLI aplica no **último projeto vinculado** (gravado em `supabase/.temp/project-ref`), por isso o `push` confere esse arquivo: se ele não for o ref do ambiente pedido (lido de `SUPABASE_PROJECT_REF_TESTE` ou `SUPABASE_PROJECT_REF_PRODUCAO`), o comando recusa e manda refazer o `link` (achado M2).

## 3. Guardas contra comandos destrutivos

`scripts/db-remoto.mjs` (testado em `tests/unit/db-remoto.test.ts`):

- só aceita `link` e `push`; qualquer `reset`, `drop`, `truncate` ou `delete` é recusado;
- exige o ambiente (`teste` ou `producao`) e as variáveis do projeto correspondente;
- produção exige `--confirmo=producao`;
- recusa teste e produção com a mesma referência;
- `push` só roda se `supabase/.temp/project-ref` for o ref do ambiente pedido (os refs vêm das variáveis de ambiente, nunca fixos no código); vinculada a outro projeto ou a nenhum, recusa;
- não imprime nenhum valor.

`podeResetar(url)` no mesmo arquivo só aceita URL local (loopback). `supabase db reset` deve ser usado somente com `--local` (padrão), e nunca com `--linked`. Evite `npx supabase db reset --linked`.

## 4. Vercel

1. Importar o repositório (quando existir no GitHub).
2. Framework: Next.js (detectado). Node 24. Comandos padrão (`npm ci`, `npm run build`); não é preciso `vercel.json`.
3. Variáveis conforme a matriz acima. `SUPABASE_SECRET_KEY` sem prefixo `NEXT_PUBLIC`.
4. Domínio de produção e de teste: definir com a TI. Depois de existirem, atualizar o CSP (abaixo) e `SITE_URL`.
5. Em Settings > Git: ativar prévias para PRs; em Settings > Deployment Protection, proteger as prévias (login Vercel) para não ficarem públicas.

## 5. GitHub Actions: migrations no teste

`.github/workflows/migrations-teste.yml` aplica as migrations no projeto de teste quando algo muda em `supabase/migrations` na `main` (ou manualmente). Usa o *environment* `teste` do GitHub com os secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_TESTE` e `SUPABASE_PROJECT_REF_TESTE`. O pgTAP já roda antes, no `ci.yml`. **Produção não é aplicada por workflow**: é decisão humana, com `npm run db:push:producao` (ou, no futuro, um environment com aprovação manual).

**Restringir o environment à `main` (B5; configuração do repositório, não do código).** Quem tem escrita poderia disparar o workflow (`workflow_dispatch`) a partir de outra branch com o YAML alterado, ler os secrets ou aplicar migration não revisada. No GitHub:

1. Settings > Environments > `teste` (criar se não existir).
2. "Deployment branches and tags": escolher **Selected branches and tags** e adicionar só a regra `main` (Selected branches: main). Nenhuma outra branch ou tag.
3. Se o plano do repositório permitir: "Required reviewers" com o Mathaus (ou o responsável pelas migrations) e "Prevent self-review".
4. Cadastrar os três secrets **dentro do environment** `teste`, não em "Repository secrets".
5. Settings > Branches: proteger a `main` (PR obrigatório, CI verde), para que a regra do environment valha de fato.

O workflow também tem `if: github.ref == 'refs/heads/main'` no job, como segunda barreira (tests/unit/ci-workflow.test.ts).

## 6. CSP com domínios reais

`src/lib/security/csp.ts` monta o `connect-src` e o `form-action` a partir de `NEXT_PUBLIC_SUPABASE_URL`, então o projeto de teste ou de produção entra no CSP sem editar código. Nada a mudar até existirem outros domínios (por exemplo storage de fotos, tarefa futura). Depois do primeiro deploy, abrir o app e conferir no console do navegador que não há violações de CSP.

## 7. Backup e restauração (produção)

- **Backup automático**: ativar no projeto de produção (Database > Backups). Plano pago: backup diário; para recuperação em ponto no tempo (PITR), contratar o complemento se a retenção definida pelo Mathaus exigir. Retenção em dias: pendente (dúvida abaixo).
- **Backup extra, fora do Supabase**: semanalmente, `pg_dump` do banco de produção para armazenamento da empresa, criptografado, executado por quem tem a senha do banco. Comando de referência (não gravar a senha no histórico; usar `PGPASSWORD` na sessão):
  ```
  pg_dump --format=custom --no-owner --file=backup-AAAA-MM-DD.dump "<string-de-conexao-do-projeto>"
  ```
- **Dados de storage** (fotos, relatórios): o backup do banco não cobre arquivos. Definir cópia periódica quando o storage for implementado (tarefa futura).
- **Restauração**: (1) pelo painel do Supabase, restaurar o backup diário ou o ponto no tempo desejado; (2) ou criar um projeto novo e `pg_restore --no-owner --dbname "<conexao-do-novo-projeto>" backup.dump`; (3) reaplicar o domínio permitido (`npm run auth:domain`) e conferir `auth` e `app_private.auth_settings`; (4) atualizar `NEXT_PUBLIC_SUPABASE_URL` e chaves na Vercel se o projeto mudou.
- **Teste de restauração**: não faz parte desta tarefa (Fase 6). Até lá, a restauração é um procedimento documentado, **não validado**.
- Regras do projeto que valem na restauração: `change_history` é imutável; nunca editar dados de campo diretamente para "corrigir" o restaurado.

## 8. Endereços de retorno do OAuth por ambiente (para a TI)

Valores a preencher quando os projetos e domínios existirem. O fluxo (docs/auth-microsoft.md): o Entra ID devolve ao Supabase; o Supabase devolve ao app.

| Ambiente | URI de redirecionamento no Entra ID (Web) | URL de retorno do app (Supabase Auth > URL Configuration) |
| --- | --- | --- |
| Local | `http://127.0.0.1:54321/auth/v1/callback` | `http://127.0.0.1:3000/auth/callback` |
| Teste | `https://<ref-do-projeto-de-teste>.supabase.co/auth/v1/callback` | `https://<endereço-do-app-de-teste>/auth/callback` |
| Produção | `https://<ref-do-projeto-de-producao>.supabase.co/auth/v1/callback` | `https://<endereço-do-app-de-producao>/auth/callback` |

Prévias com endereço variável da Vercel não devem ser cadastradas no Entra ID; o teste usa um domínio fixo. No Supabase de produção, a lista de URLs permitidas deve conter apenas o endereço de produção.

## 9. Checklist de go-live

- [ ] Projetos Supabase de teste e produção criados, em contas da empresa, região definida.
- [ ] Migrations aplicadas no teste (`db:push:teste`) e testes de acesso (pgTAP) passando; depois em produção (`--dry-run` revisado).
- [ ] Variáveis na Vercel conforme a matriz; nenhuma variável de produção marcada para Preview/Development.
- [ ] Prévia aberta e conferida: aponta para o projeto de teste.
- [ ] `AUTH_LOCAL_PASSWORD_LOGIN` vazia e `APP_ENV=production` em produção; tela de login sem formulário de senha.
- [ ] Entra ID registrado (TI) com os endereços da seção 8; login Microsoft funcionando em teste.
- [ ] Domínio de e-mail gravado (`auth:domain`) e `ALLOWED_EMAIL_DOMAIN` definida na Vercel (Preview e Production).
- [ ] Runbook 1.1 feito nos dois projetos: provedor Email desligado, hook "Before User Created" habilitado, `allow_non_azure_providers = false`, cadastro por senha e de outro domínio testados e recusados.
- [ ] **Bloqueio de go-live (B1):** `require_verified_email_claim = true` em produção, depois de a TI emitir a claim `xms_edov` e de o caminho da claim ser confirmado no primeiro login real.
- [ ] Environment `teste` do GitHub restrito à `main` (seção 5).
- [ ] Primeiro usuário `coordination` atribuído; um usuário sem perfil vê "Aguardando liberação".
- [ ] Backup automático de produção ativo; primeira cópia `pg_dump` guardada; retenção registrada.
- [ ] `SUPABASE_SECRET_KEY` só no servidor (bundle conferido por `npm run test:security`).
- [ ] CSP conferido no navegador nos dois ambientes (sem violações).
- [ ] gitleaks e `npm run verify` verdes no commit implantado.
- [ ] Proteção de implantação das prévias ativa.
- [ ] Responsável por aplicar migrations em produção definido.

## Pendências

- Contas e pagamento (Vercel e Supabase), região, retenção de backup e titularidade do repositório dependem do Mathaus.
- Critério "migrations aplicam em projeto remoto de teste": pendente até o projeto existir.
