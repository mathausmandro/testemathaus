# CLAUDE.md

Instruções para o Claude Code neste repositório. Leia este arquivo, AGENTS.md, docs/CONTEXTO.md e docs/PLANO.md antes de qualquer tarefa.

## O que é este projeto

Plataforma web para automatizar ensaios agronômicos: a partir de um protocolo padrão, gera casualização, croqui, cronograma, fichas de avaliação e caderno de campo; a equipe de campo coleta dados por parcela no celular (inclusive offline); o home office confere os dados; o sistema alimenta o relatório técnico agronômico. Dono do produto: Mathaus, pesquisador que coordena os ensaios.

## Stack

- Next.js 16 (App Router) com TypeScript, front e back no mesmo projeto (Server Components, Server Actions e Route Handlers)
- PWA instalável com Serwist (service worker) e IndexedDB para a fila offline
- Supabase: Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron
- Login Microsoft (Entra ID, tenant único), restrito ao domínio de e-mail da empresa
- Vercel (plano pago) para hospedagem
- Docker para o app local; Supabase CLI para o banco local
- Protótipo de interface feito no Lovable (React com Vite, dados fictícios), usado como referência e fonte de componentes

## Comandos

- Instalar: npm ci
- Desenvolvimento: npm run dev
- Build: npm run build
- Lint e tipos: npm run lint e npm run typecheck
- Testes unitários: npm test
- Testes de ponta a ponta: npm run test:e2e
- Testes de acesso no banco: supabase test db
- Auditoria de performance: npm run test:perf
- Auditoria de segurança: npm run test:security
- Supabase local: supabase start, supabase db reset, supabase migration new NOME
- Docker: docker compose --profile dev up --build (ou --profile prod)

## Variáveis de ambiente

- NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: públicas
- SUPABASE_SECRET_KEY: só servidor e Edge Functions
- ALLOWED_EMAIL_DOMAIN: só servidor e banco; valor pendente
- .env.example versionado com os nomes; .env.local fora do repositório

## Regras inegociáveis

1. Segurança fica no banco. Toda tabela com dado de ensaio tem RLS ligada, nega por padrão e tem políticas por perfil. Nunca confie só na tela.
2. SUPABASE_SECRET_KEY só existe no servidor. Nunca em código de cliente, nunca em variável NEXT_PUBLIC, nunca no repositório, nunca na imagem Docker.
3. Chamadas ao Supabase passam pela camada de acesso a dados em src/lib/data, tipada.
4. Toda mudança de esquema é uma migration em supabase/migrations. Nunca altere o banco só pelo painel.
5. Dados de campo têm histórico imutável: toda edição grava autor, data, motivo, valor anterior e valor novo em change_history, que só aceita inclusão. Registros de campo não são excluídos; são anulados com motivo.
6. Acesso exige domínio de e-mail permitido E perfil atribuído pela coordenação. Perfis: coordination, field, home_office.
7. Ensaios só são visíveis a quem está em trial_members, exceto coordination.
8. A casualização grava a semente do sorteio e é reproduzível.
9. Fotos e relatórios em storage privado, com links temporários.
10. A fila offline nunca perde dado: só remove após confirmação do servidor e usa id gerado no aparelho para não duplicar.
11. Datas em timestamptz, exibidas em America/Sao_Paulo. pg_cron roda em UTC.
12. Interface em português do Brasil. Tabelas e colunas em inglês, snake_case.
13. Em dúvida sobre regra agronômica, estatística ou protocolo, pare e pergunte ao Mathaus.

## Como trabalhar

- Siga as fases de docs/PLANO.md, na ordem, e os papéis de agentes do AGENTS.md.
- Entregas pequenas, um commit por unidade lógica, mensagens claras.
- Testes junto com o código: acesso por perfil, casualização, cronograma e fila offline.
- Rode lint, tipos e testes antes de dizer que terminou.
- Ao terminar uma tarefa, atualize a seção Status de docs/PLANO.md.

## Pendências conhecidas

- Domínio de e-mail da empresa: não informado. Não fixe valor no código.
- Registro do app no Entra ID e Microsoft Graph: aguardando a TI.
- Ensaio piloto: a definir.
- WhatsApp: adiado de propósito. Não implementar.

## Papéis de agentes

Definidos em .claude/agents e descritos no AGENTS.md: analista (sonnet), desenvolvedor (sonnet; opus para RLS, autenticação e offline), qa (haiku), performance (sonnet) e seguranca (opus). Cada papel roda como subagente separado. A orquestração segue a skill task-management.

## Skills do projeto

Em .claude/skills: nextjs-app-router, task-management, security-engineer, supabase-schema-rls, microsoft-auth-domain, experiment-design, field-collection-offline, notifications-calendar, technical-report e docker-local-env.
