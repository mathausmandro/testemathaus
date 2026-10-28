# 018 - Ambientes de teste e produção, Vercel e backup
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: sonnet

## Objetivo
Documentar e preparar os ambientes teste (staging) e produção separados, com variáveis por ambiente, fluxo de migrations para a nuvem e backup em produção, de modo que o código já esteja pronto quando as contas e os valores existirem.

## Escopo
Inclui:
- Runbook docs/ambientes.md: criar projeto Supabase de teste e de produção, vincular com supabase link, aplicar migrations (supabase db push) por ambiente, configurar variáveis na Vercel por ambiente (prévia e produção), ativar backup automático em produção (plano pago).
- Scripts/checagens que impedem rodar comandos destrutivos (db reset) contra projeto remoto; confirmação explícita para db push em produção.
- Workflow do GitHub Actions (ou documentação) para aplicar migrations no projeto de teste a partir da branch principal, com segredos guardados no GitHub/Vercel, nunca no repositório.
- Matriz de variáveis por ambiente (quais existem em local, teste e produção; SUPABASE_SECRET_KEY só no servidor; prévias nunca apontam para produção).
- Checklist de endereços de retorno do OAuth por ambiente para entregar à TI.
- Ajuste do CSP (017) para os domínios reais quando existirem.

Não inclui: criar contas, projetos ou pagar planos (ação do Mathaus); teste de restauração (Fase 6); monitoramento (Fase 6); registrar segredos reais.

## Arquivos afetados
docs/ambientes.md, scripts/*, .github/workflows/*, .env.example, next.config.ts (CSP).

## Critérios de aceite
- [ ] O runbook permite a uma pessoa nova criar os dois ambientes seguindo apenas o documento (revisado pelo Mathaus).
- [ ] Os scripts recusam db reset contra qualquer URL que não seja local (teste).
- [ ] Prévias da Vercel não têm acesso às variáveis de produção (matriz revisada).
- [ ] Nenhum segredo, URL de projeto real ou domínio real no repositório (gitleaks e busca).
- [ ] Lista de endereços de retorno por ambiente pronta para envio à TI.
- [ ] Migrations aplicam em um projeto remoto de teste, se já existir; caso contrário, o critério fica registrado como pendente e não bloqueia a tarefa.

## Testes esperados
Unitários: guarda dos scripts contra ambiente remoto. e2e: não se aplica. pgTAP: roda no CI antes do push das migrations. Performance: não se aplica. Segurança: separação de segredos por ambiente, revisão da regra de que prévias não usam produção.

## Riscos e dependências
- Depende de 002, 004 e 010; contas da Vercel e do Supabase dependem do Mathaus e do orçamento.
- Risco: apontar prévia para banco de produção ou aplicar migration errada em produção.

## Dúvidas para o Mathaus
- Quem cria e paga as contas (Vercel e Supabase em plano pago) e em que prazo?
- Região do projeto Supabase e requisitos de retenção de backup (dias)?
- O repositório e as contas serão da empresa ou pessoais?

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer contas da Vercel e do Supabase, Docker e repositório remoto.

Arquivos: docs/ambientes.md (runbook, matriz de variáveis, backup e restauração, endereços de retorno para a TI, checklist de go-live), scripts/db-remoto.mjs (guarda: só link e push; recusa reset; produção exige --confirmo=producao; teste e produção com refs distintos), tests/unit/db-remoto.test.ts, .github/workflows/migrations-teste.yml (environment teste, secrets no GitHub), package.json (db:link:teste, db:push:teste, db:push:producao, setup:local, doctor).

Como testar: npm test (db-remoto.test.ts). Com projeto de teste criado: seguir docs/ambientes.md seção 1.

Pendentes: aplicar migrations em projeto remoto (não existe); gitleaks roda no CI; CSP não precisou de ajuste (deriva de NEXT_PUBLIC_SUPABASE_URL), conferir no navegador após o primeiro deploy; restauração documentada, não validada (Fase 6). Dúvidas do Mathaus seguem abertas.

### Correções pós-revisão final (28/10/2026, segurança M1, M2 e B5)

- M2: antes do `push`, `scripts/db-remoto.mjs` confere se `supabase/.temp/project-ref` é o ref do ambiente pedido (lido de `SUPABASE_PROJECT_REF_TESTE` ou `SUPABASE_PROJECT_REF_PRODUCAO`, nunca fixo no código). Se a pasta estiver vinculada a outro projeto ou a nenhum, o comando recusa sem imprimir os refs. Produção continua exigindo `--confirmo=producao`. Novo script `npm run db:link:producao`. Testes em `tests/unit/db-remoto.test.ts`.
- M1: `docs/ambientes.md` ganhou a seção 1.1 (desligar o provedor e-mail/senha, habilitar o hook "Before User Created", conferir `app_private.auth_settings`, testar cadastro por senha e de outro domínio) e itens novos no checklist. O B1 (`require_verified_email_claim = true`) entrou no checklist como bloqueio de go-live.
- B5: `docs/ambientes.md`, seção 5, descreve o que configurar no GitHub: environment `teste` com "Selected branches: main", revisor obrigatório, secrets no environment e proteção da `main`. O job de `.github/workflows/migrations-teste.yml` ganhou `if: github.ref == 'refs/heads/main'`. Teste em `tests/unit/ci-workflow.test.ts`.
- B2, B3, B4 e B6 ficaram registrados como pendências em `docs/seguranca/decisoes.md` (D5), sem implementação.
