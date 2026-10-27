# 008 - Migration: histórico imutável (change_history) e gatilhos
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

## Objetivo
Garantir no banco que toda alteração em dado de campo (e em dados sensíveis de protocolo e perfis, conforme decisão) grave autor, data, motivo, valor anterior e valor novo em change_history, que só aceita inclusão.

## Escopo
Inclui:
- Tabela change_history (tabela, id do registro, autor, data e hora timestamptz, motivo, valor anterior e novo em jsonb).
- Gatilho genérico (função) aplicado a field_records, field_record_photos, applications, occurrences e quality_flags; motivo obrigatório em UPDATE e em anulação, lido de configuração da transação ou de coluna dedicada, com falha clara quando ausente.
- Gatilho que também registra alterações de role em profiles e de membros de ensaio (rastreio de acessos), se aprovado pelo Mathaus (ver dúvidas); por padrão incluir.
- change_history: RLS com apenas INSERT/SELECT; sem UPDATE nem DELETE para nenhum perfil (inclusive coordination e dono do banco via REVOKE e gatilho de bloqueio); autor sempre vindo de auth.uid(), nunca de parâmetro do cliente.
- Visibilidade de leitura do histórico por perfil e por ensaio.
- Testes pgTAP.

Não inclui: telas de histórico, exportação para o caderno de campo (Fase 2 e 5).

## Arquivos afetados
supabase/migrations/*_historico_imutavel.sql, supabase/tests/*.

## Critérios de aceite
- [ ] supabase db reset e supabase test db passam.
- [ ] UPDATE em field_records por field/coordination com motivo gera linha em change_history com valor anterior e novo corretos e autor igual a auth.uid().
- [ ] UPDATE sem motivo é rejeitado.
- [ ] UPDATE e DELETE em change_history falham para todos os perfis, inclusive coordination.
- [ ] O autor gravado não pode ser forjado pelo cliente (tentativa de passar outro autor falha ou é ignorada).
- [ ] RLS: field e home_office leem o histórico apenas de ensaios atribuídos; usuário sem perfil não lê nada.
- [ ] Atualizar updated_at por si só não gera ruído de histórico (comportamento documentado).

## Testes esperados
pgTAP: gravação do histórico por tabela, motivo obrigatório, imutabilidade, autor não forjável, leitura por perfil. Unitários: não se aplica. Performance: custo do gatilho em lote (ex.: 1000 registros) medido. Segurança: tentativa de contornar com função security definer e com TRUNCATE; checklist Banco e RLS.

## Riscos e dependências
- Depende de 007. Risco: TRUNCATE, ou superusuário/migration futura que apague o histórico; mitigar com REVOKE e documentação.
- Fluxo de passar o motivo ao banco (parâmetro de sessão versus coluna) impacta a camada src/lib/data (011); definir e documentar.

## Dúvidas para o Mathaus
- O histórico também deve cobrir mudanças de perfil, atribuição a ensaios e alteração de protocolo? (sugestão: sim)
- Existe exigência de BPL/BPA sobre retenção do histórico (por quantos anos)?
- Quem pode ler o histórico: todos do ensaio ou só coordination e home_office?

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (orientação de 27/10/2026). Validação só estática (parser do Postgres 17 no Vitest; corpos PL/pgSQL revisados à mão, o parser não os valida).

### Arquivos alterados
- Novos: `supabase/migrations/20261027170300_historico_imutavel.sql`, `supabase/tests/008_historico_imutavel.test.sql`.
- Alterados: `src/lib/data/database.types.ts` (`change_history` e `change_reason` nas 5 tabelas de campo), `tests/unit/migrations.test.ts` (confere gatilhos de histórico e de bloqueio em cada tabela de campo).

### O que foi feito
- `change_history` (tabela, id do registro, `trial_id`, operação, `author_id`, `actor_role`, `changed_at` timestamptz, motivo, `old_value`/`new_value` jsonb). `trial_id` sem FK, para o histórico sobreviver.
- Gatilhos nas 5 tabelas de campo: `zz_capture_change` (BEFORE INSERT/UPDATE, SECURITY DEFINER) exige motivo no UPDATE e grava valor anterior e novo; `zz_log_insert` (AFTER INSERT) grava a criação, só se a linha entrou (reenvio com `ON CONFLICT DO NOTHING` não gera histórico falso).
- Contrato do motivo (para a 011): coluna `change_reason` no próprio UPDATE (preferencial; o gatilho grava e limpa, então cada UPDATE precisa de novo motivo) ou `set_config('app.change_reason', ..., true)` na transação; na anulação, `voided_reason` também vale. Sem motivo: erro "Motivo obrigatório para alterar <tabela>".
- UPDATE que só muda `updated_at` (ou nada) não gera histórico nem exige motivo.
- Rastreio de acessos (incluído por padrão, ver dúvidas): mudança de `role` em profiles (só o papel, sem e-mail) e inclusão/alteração/remoção em `trial_members`, com motivo opcional via `app.change_reason`.
- Imutabilidade: RLS só com política de SELECT; INSERT/UPDATE/DELETE/TRUNCATE revogados de anon, authenticated e service_role (só SELECT concedido); gatilhos bloqueiam UPDATE/DELETE/TRUNCATE até para o dono do banco; gatilho `change_history_stamp` sobrescreve `author_id` (auth.uid()), `actor_role` e `changed_at`. Funções de gatilho com EXECUTE revogado de public/anon/authenticated.
- Leitura: coordination tudo; field e home_office só o histórico dos ensaios atribuídos; registros sem ensaio (perfis) só coordination; sem perfil e anon nada.

### Como testar
- Aqui: `npm test`.
- Com Docker (pendente): `npx supabase db reset`, `npx supabase test db` (arquivo `008_historico_imutavel.test.sql`: gravação por tabela, motivo obrigatório por coluna/transação/anulação, sem ruído de updated_at, idempotência sem histórico duplicado, imutabilidade para field/home_office/coordination/postgres, autor e data não forjáveis, leitura por perfil e ensaio, rastreio de role e membros).
- Performance (pendente): medir o custo do gatilho em lote, por exemplo `explain analyze insert into field_records ... select ... from generate_series(1, 1000)` com e sem os gatilhos `zz_*`.

### Desvios e observações
- INSERT em `change_history` não tem política para clientes (mais estrito que "INSERT/SELECT"): só os gatilhos inserem, para ninguém criar histórico falso.
- Também se registra a inclusão (INSERT) de dado de campo, não só a edição. Isso dobra as gravações; medir na tarefa de performance.
- Motivo também é exigido para tratar `quality_flags` (a camada de dados pode mandar, por exemplo, "Conferido").
- Risco residual: superusuário ou migration pode desligar gatilhos ou apagar a tabela. Mitigação: REVOKE, gatilhos e revisão do papel seguranca em toda migration que toque `change_history`. Retenção: indefinida (sem rotina de expurgo).
- Exclusão de usuário em auth.users com registros de campo falha (FK de `created_by`); desligamento é por revogação do perfil.

### Dúvidas para o Mathaus (acréscimo do desenvolvedor)
- Confirmar o registro de role e atribuição (incluído por padrão). Mudança de protocolo (tratamentos, parcelas) ainda não gera histórico: incluir?
- Prazo de retenção do histórico (BPL/BPA).
- Quem lê o histórico: hoje todos os membros do ensaio (inclusive field).
