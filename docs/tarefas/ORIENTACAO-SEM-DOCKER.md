# Orientação: tarefas 003 a 019 sem Docker e sem banco

Decisão do Mathaus em 27/10/2026: terminar o código mesmo sem Docker e sem Supabase rodando nesta máquina. A validação com banco e containers será feita depois, na máquina do parceiro desenvolvedor.

## O que vale para todos os papéis

- Escreva o código completo da tarefa: migrations, políticas de RLS, testes pgTAP, Dockerfile, telas, Server Actions, testes unitários e e2e.
- O que precisa de Docker ou banco (supabase start, supabase test db, supabase gen types, docker build, e2e autenticado) não roda aqui. Escreva assim mesmo e marque no topo do arquivo ou na tarefa: "não executado: requer Docker/Supabase local".
- Tipos do banco: escreva src/lib/data/database.types.ts à mão, no formato do `supabase gen types typescript`, coerente com as migrations. O parceiro regenera com o comando e compara.
- npm run verify precisa continuar passando aqui (a etapa pgTAP aparece como ignorada quando o Supabase local não está rodando). Com CI=true, a ausência continua reprovando.
- Testes unitários não podem depender de banco: isole a lógica (casualização, validação com zod, regras de perfil, montagem de consultas) e teste com Vitest.
- Nunca fixe domínio de e-mail, tenant, chaves ou URLs reais. Use variáveis de ambiente e .env.example só com nomes.
- Em dúvida de regra agronômica, estatística ou de protocolo: não invente. Implemente a estrutura, registre a dúvida na tarefa em "Dúvidas para o Mathaus" e siga.
- Ao terminar, preencha "Entrega" e mude o Status para "pronta para validação (requer Docker/Supabase)" quando houver parte não executada, ou "em QA" quando tudo rodou.
- Um commit por tarefa, em português, terminando com a linha Co-Authored-By indicada pelo orquestrador. Não faça push; o orquestrador envia ao GitHub.
- Não comite arquivos .docx soltos na raiz nem .env.local.

## Checklist para o parceiro (validação posterior)

1. Instalar Docker Desktop, Node 24 e rodar npm ci.
2. npx supabase start, depois npx supabase db reset (aplica migrations e seed).
3. npx supabase test db (pgTAP: matriz de acesso por perfil).
4. npx supabase gen types typescript --local e comparar com src/lib/data/database.types.ts.
5. docker compose --profile dev up --build e --profile prod.
6. npm run verify com o Supabase local rodando (pgTAP deixa de ser ignorada).
7. Registrar o resultado em docs/qa/validacao-docker.md e abrir correções como tarefas novas.
