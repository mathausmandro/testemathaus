# 009 - Migration: preferências, avisos, push e tokens do feed iCal
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

## Objetivo
Completar o esquema de dados da Fase 1 com as tabelas de avisos e calendário (apenas estrutura e RLS), para que o plano de migrations contenha todas as tabelas previstas, sem implementar o envio.

## Escopo
Inclui:
- Tabelas notification_preferences, notification_log, push_subscriptions e calendar_feed_tokens.
- RLS: cada pessoa lê e altera apenas as próprias preferências, inscrições push e tokens; notification_log legível pelo dono e pela coordenação, gravável só por serviço (sem política de escrita para usuários); coordination pode revogar tokens.
- calendar_feed_tokens: armazenar apenas o hash do token, nunca o valor em texto, com data de revogação.
- Sem dados pessoais desnecessários no log.
- Testes pgTAP.

Não inclui: pg_cron, Edge Function, envio de push ou e-mail, feed iCal (Fase 4).

## Arquivos afetados
supabase/migrations/*_avisos_calendario.sql, supabase/tests/*.

## Critérios de aceite
- [ ] supabase db reset e supabase test db passam.
- [ ] RLS ligada nas quatro tabelas, sem using (true).
- [ ] Uma pessoa não lê nem altera preferências, inscrições nem tokens de outra; coordination não lê o valor do token.
- [ ] Usuário sem perfil não acessa as tabelas de outros; field/home_office não escrevem em notification_log.
- [ ] Token do feed é guardado como hash; teste confirma que o texto original não existe no banco.
- [ ] Todas as datas são timestamptz.

## Testes esperados
pgTAP: matriz por perfil; propriedade de dados; hash do token. Unitários: não se aplica. Performance: índices por usuário e por data. Segurança: checklist Banco e RLS e itens do feed iCal (token longo, revogável).

## Riscos e dependências
- Depende de 005. Baixo risco funcional; risco de segurança em tokens.
- Pode rodar em paralelo a 006 a 008.

## Dúvidas para o Mathaus
- Antecedência padrão dos avisos e canais ativados por padrão (adiável para a Fase 4).
- Por quanto tempo guardar notification_log (LGPD)?

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (orientação de 27/10/2026). Validação só estática (parser do Postgres 17 no Vitest; corpo PL/pgSQL do gatilho revisado à mão).

### Arquivos alterados
- Novos: `supabase/migrations/20261027170400_avisos_calendario.sql`, `supabase/tests/009_avisos_calendario.test.sql`.
- Alterados: `src/lib/data/database.types.ts` (4 tabelas), `tests/unit/migrations.test.ts` (log sem política de escrita, token só como hash e sem DELETE, tabelas pessoais só do dono).

### O que foi feito
- `notification_preferences` (uma linha por pessoa; `push_enabled`, `email_enabled` e `lead_time_hours` nulos = padrão do sistema, ainda pendente), `push_subscriptions` (endpoint https, `p256dh`, `auth_secret`; única por pessoa e endpoint), `calendar_feed_tokens` (`token_hash` SHA-256 hex com CHECK, `label`, `last_used_at`, `revoked_at`, `revoked_by`), `notification_log` (destinatário, ensaio, avaliação prevista, canal, tipo, situação, `dedupe_key` única para nunca repetir, `error_code`, `sent_at`). Todas as datas em timestamptz.
- RLS ligada nas quatro, sem `using (true)`. Leitura: só o dono (tokens e log também a coordenação). Escrita: só o dono e só com perfil atribuído; sem perfil não grava nada. notification_log sem política nem privilégio de escrita para clientes (grava o serviço, na Fase 4).
- Token do feed: o banco recebe só o hash (o servidor gera o token, mostra uma vez e envia o hash). `token_hash` não pode ser lido por nenhum cliente (privilégio por coluna), nem pelo dono nem pela coordenação. Gatilho `calendar_feed_token_guard`: dono e hash imutáveis, revogação definitiva (não volta a nulo), `revoked_by`/`revoked_at` carimbados pelo banco, coordenação revoga token alheio mas não altera outros campos dele. Sem DELETE (fica para auditoria); rotação = revogar e criar outro.
- Log sem dado pessoal: sem e-mail, endpoint ou texto da mensagem; `dedupe_key` documentada para conter só ids e datas.
- Índices: `notification_log (user_id, sent_at)`, `(sent_at)`, `(trial_id)`, `(planned_assessment_id)`; `calendar_feed_tokens (user_id, created_at)`; as chaves únicas cobrem preferências, inscrições, hash e dedupe.
- Sem pg_cron, Edge Function, envio ou feed (Fase 4). Nenhum segredo na migration.

### Como testar
- Aqui: `npm test`.
- Com Docker (pendente): `npx supabase db reset` e `npx supabase test db` (arquivo `009_avisos_calendario.test.sql`: estrutura, propriedade dos dados por perfil, sem perfil, anon, revogação, e varredura de todas as tabelas do schema public provando que o token em claro não está gravado).

### Desvios e observações
- Coordination lê os metadados dos tokens de todos (sem o hash), para poder revogar. Não lê preferências nem inscrições push de ninguém.
- Contrato para a Fase 4: a Edge Function do feed procura por `token_hash` com service_role e precisa recusar token revogado e dono sem perfil (revogar o perfil não revoga os tokens sozinho; considerar na tarefa 015 ou na Fase 4).
- Clientes não podem usar `select *` em `calendar_feed_tokens` (dá 42501 por causa de `token_hash`); a camada de dados (011) deve listar as colunas.
- Mesmo aparelho usado por duas pessoas pode ter duas inscrições com o mesmo endpoint (chave única por pessoa e endpoint); tratar na Fase 4.

### Dúvidas para o Mathaus (acréscimo do desenvolvedor)
- Mantidas: antecedência padrão e canais ativados por padrão; prazo de guarda do notification_log (LGPD). Hoje não há rotina de expurgo; o índice por `sent_at` já atende uma futura.
