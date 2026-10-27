-- Tarefa 008: histórico imutável (change_history): gravação por gatilho, motivo obrigatório, imutabilidade,
-- autor não forjável e leitura por perfil/ensaio.
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Fixtures próprias (prefixo 08...), desfeitas no rollback. Perfis simulados por claims JWT, sem chave secreta.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem claims e sem app.change_reason)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('08000000-0000-4000-8000-000000000001', 'coord.008@exemplo.test'),
  ('08000000-0000-4000-8000-000000000002', 'campo.008@exemplo.test'),
  ('08000000-0000-4000-8000-000000000003', 'escritorio.008@exemplo.test'),
  ('08000000-0000-4000-8000-000000000004', 'semperfil.008@exemplo.test'),
  ('08000000-0000-4000-8000-000000000005', 'campob.008@exemplo.test');
update public.profiles set role = 'coordination' where id = '08000000-0000-4000-8000-000000000001';
update public.profiles set role = 'field' where id in ('08000000-0000-4000-8000-000000000002', '08000000-0000-4000-8000-000000000005');
update public.profiles set role = 'home_office' where id = '08000000-0000-4000-8000-000000000003';

insert into public.trials (id, code) values
  ('08100000-0000-4000-8000-00000000000a', 'T008-A'),
  ('08100000-0000-4000-8000-00000000000b', 'T008-B');
insert into public.trial_members (trial_id, user_id) values
  ('08100000-0000-4000-8000-00000000000a', '08000000-0000-4000-8000-000000000002'),
  ('08100000-0000-4000-8000-00000000000a', '08000000-0000-4000-8000-000000000003'),
  ('08100000-0000-4000-8000-00000000000a', '08000000-0000-4000-8000-000000000004'),
  ('08100000-0000-4000-8000-00000000000b', '08000000-0000-4000-8000-000000000005');
insert into public.plots (id, trial_id, number) values
  ('08400000-0000-4000-8000-00000000000a', '08100000-0000-4000-8000-00000000000a', 1),
  ('08400000-0000-4000-8000-00000000000b', '08100000-0000-4000-8000-00000000000b', 1);
insert into public.assessment_variables (id, trial_id, name) values
  ('08500000-0000-4000-8000-00000000000a', '08100000-0000-4000-8000-00000000000a', 'V'),
  ('08500000-0000-4000-8000-00000000000b', '08100000-0000-4000-8000-00000000000b', 'V');
insert into public.planned_assessments (id, trial_id, variable_id) values
  ('08600000-0000-4000-8000-00000000000a', '08100000-0000-4000-8000-00000000000a', '08500000-0000-4000-8000-00000000000a'),
  ('08600000-0000-4000-8000-00000000000b', '08100000-0000-4000-8000-00000000000b', '08500000-0000-4000-8000-00000000000b');
insert into public.field_records (id, client_id, trial_id, plot_id, planned_assessment_id, value_numeric, created_by) values
  ('08700000-0000-4000-8000-0000000000a1', '08900000-0000-4000-8000-0000000000a1', '08100000-0000-4000-8000-00000000000a',
   '08400000-0000-4000-8000-00000000000a', '08600000-0000-4000-8000-00000000000a', 10, '08000000-0000-4000-8000-000000000002'),
  ('08700000-0000-4000-8000-0000000000b1', '08900000-0000-4000-8000-0000000000b1', '08100000-0000-4000-8000-00000000000b',
   '08400000-0000-4000-8000-00000000000b', '08600000-0000-4000-8000-00000000000b', 30, '08000000-0000-4000-8000-000000000005');
insert into public.quality_flags (id, trial_id, field_record_id, created_by) values
  ('08740000-0000-4000-8000-0000000000a1', '08100000-0000-4000-8000-00000000000a', '08700000-0000-4000-8000-0000000000a1', '08000000-0000-4000-8000-000000000003');

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.change_history'::regclass), 'RLS ligada em change_history');
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and tablename = 'change_history' and cmd <> 'SELECT' $$,
  'change_history só tem política de leitura'
);
select ok(not has_table_privilege('authenticated', 'public.change_history', 'insert'), 'authenticated não insere direto em change_history');
select ok(not has_table_privilege('authenticated', 'public.change_history', 'update'), 'authenticated sem UPDATE em change_history');
select ok(not has_table_privilege('authenticated', 'public.change_history', 'delete'), 'authenticated sem DELETE em change_history');
select ok(not has_table_privilege('authenticated', 'public.change_history', 'truncate'), 'authenticated sem TRUNCATE em change_history');
select ok(not has_table_privilege('service_role', 'public.change_history', 'update'), 'service_role sem UPDATE em change_history');
select ok(not has_table_privilege('service_role', 'public.change_history', 'delete'), 'service_role sem DELETE em change_history');
select ok(not has_table_privilege('anon', 'public.change_history', 'select'), 'anon não lê change_history');
select ok(not has_function_privilege('authenticated', 'public.capture_field_change()', 'execute'), 'authenticated não executa capture_field_change');
select ok(not has_function_privilege('authenticated', 'public.log_access_change()', 'execute'), 'authenticated não executa log_access_change');

-- Inclusões das fixtures foram registradas (operação de sistema: autor nulo).
select is(
  (select count(*)::int from public.change_history
    where table_name = 'field_records' and record_id = '08700000-0000-4000-8000-0000000000a1' and operation = 'INSERT'),
  1, 'INSERT em field_records gera uma linha de histórico'
);
select is(
  (select new_value ->> 'value_numeric' from public.change_history
    where table_name = 'field_records' and record_id = '08700000-0000-4000-8000-0000000000a1' and operation = 'INSERT'),
  '10', 'histórico da inclusão guarda o valor inicial'
);
select ok(
  (select count(*) > 0 from public.change_history
    where table_name = 'profiles' and record_id = '08000000-0000-4000-8000-000000000002' and new_value ->> 'role' = 'field'),
  'mudança de role em profiles é registrada'
);
select ok(
  (select count(*) > 0 from public.change_history
    where table_name = 'trial_members' and trial_id = '08100000-0000-4000-8000-00000000000a' and operation = 'INSERT'),
  'atribuição a ensaio é registrada'
);

-- Imutabilidade até para o dono do banco.
select throws_ok($$ update public.change_history set reason = 'x' where trial_id = '08100000-0000-4000-8000-00000000000a' $$, '42501', null, 'postgres não altera change_history');
select throws_ok($$ delete from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000a' $$, '42501', null, 'postgres não exclui de change_history');
select throws_ok($$ truncate public.change_history $$, '42501', null, 'TRUNCATE de change_history bloqueado');

-- Autor não forjável: mesmo numa inclusão direta, o carimbo usa auth.uid().
select set_config('request.jwt.claims', '{"sub":"08000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.change_history (table_name, record_id, trial_id, operation, author_id, changed_at, reason)
values ('teste', '08700000-0000-4000-8000-0000000000a1', '08100000-0000-4000-8000-00000000000a', 'UPDATE',
        '08000000-0000-4000-8000-000000000001', '2000-01-01 00:00:00+00', 'forjado');
select is(
  (select author_id from public.change_history where table_name = 'teste' and reason = 'forjado'),
  '08000000-0000-4000-8000-000000000002'::uuid,
  'author_id enviado é ignorado; vale auth.uid()'
);
select ok(
  (select changed_at > '2000-01-02'::timestamptz from public.change_history where table_name = 'teste' and reason = 'forjado'),
  'changed_at enviado é ignorado'
);
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- field: grava histórico com autor = auth.uid(); motivo obrigatório
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"08000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_like(
  $$ update public.field_records set value_numeric = 11 where id = '08700000-0000-4000-8000-0000000000a1' $$,
  '%Motivo obrigatório%', 'UPDATE sem motivo é rejeitado'
);
select throws_like(
  $$ update public.field_records set value_numeric = 11, change_reason = '   ' where id = '08700000-0000-4000-8000-0000000000a1' $$,
  '%Motivo obrigatório%', 'motivo em branco é rejeitado'
);

with u as (update public.field_records set value_numeric = 12, change_reason = 'Erro de digitação'
           where id = '08700000-0000-4000-8000-0000000000a1' returning change_reason)
select is(max(change_reason), null, 'change_reason não fica gravado na linha') from u;

select results_eq(
  $$ select operation, reason, author_id, old_value ->> 'value_numeric', new_value ->> 'value_numeric', trial_id
     from public.change_history
     where table_name = 'field_records' and record_id = '08700000-0000-4000-8000-0000000000a1' and operation = 'UPDATE' $$,
  $$ values ('UPDATE'::text, 'Erro de digitação'::text, '08000000-0000-4000-8000-000000000002'::uuid, '10'::text, '12'::text,
             '08100000-0000-4000-8000-00000000000a'::uuid) $$,
  'UPDATE com motivo grava autor, motivo, valor anterior e novo'
);
select is(
  (select actor_role from public.change_history
    where table_name = 'field_records' and record_id = '08700000-0000-4000-8000-0000000000a1' and operation = 'UPDATE'),
  'authenticated', 'histórico guarda o papel da requisição'
);
select ok(
  (select not (old_value ? 'change_reason') and not (new_value ? 'change_reason') from public.change_history
    where table_name = 'field_records' and record_id = '08700000-0000-4000-8000-0000000000a1' and operation = 'UPDATE'),
  'change_reason não entra nos valores do histórico'
);

-- Motivo por configuração da transação.
select set_config('app.change_reason', 'Correção pela fila', true);
with u as (update public.field_records set value_numeric = 13 where id = '08700000-0000-4000-8000-0000000000a1' returning 1)
select is(count(*)::int, 1, 'UPDATE aceita motivo via app.change_reason') from u;
select set_config('app.change_reason', '', true);
select is(
  (select count(*)::int from public.change_history
    where record_id = '08700000-0000-4000-8000-0000000000a1' and operation = 'UPDATE' and reason = 'Correção pela fila'),
  1, 'motivo de app.change_reason gravado'
);

-- updated_at sozinho não gera ruído nem exige motivo.
with u as (update public.field_records set updated_at = now() where id = '08700000-0000-4000-8000-0000000000a1' returning 1)
select is(count(*)::int, 1, 'atualizar só updated_at é aceito sem motivo') from u;
select is(
  (select count(*)::int from public.change_history where record_id = '08700000-0000-4000-8000-0000000000a1' and operation = 'UPDATE'),
  2, 'atualizar só updated_at não gera histórico'
);

-- Inclusão pelo cliente e reenvio idempotente.
insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, value_numeric)
values ('08900000-0000-4000-8000-0000000000a2', '08100000-0000-4000-8000-00000000000a', '08400000-0000-4000-8000-00000000000a',
        '08600000-0000-4000-8000-00000000000a', 5);
insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, value_numeric)
values ('08900000-0000-4000-8000-0000000000a2', '08100000-0000-4000-8000-00000000000a', '08400000-0000-4000-8000-00000000000a',
        '08600000-0000-4000-8000-00000000000a', 5)
on conflict (client_id) do nothing;
select results_eq(
  $$ select h.author_id from public.change_history h
     join public.field_records r on r.id = h.record_id
     where h.table_name = 'field_records' and r.client_id = '08900000-0000-4000-8000-0000000000a2' and h.operation = 'INSERT' $$,
  $$ values ('08000000-0000-4000-8000-000000000002'::uuid) $$,
  'inclusão gera um único histórico com autor = auth.uid(), mesmo com reenvio (ON CONFLICT DO NOTHING)'
);

-- Anulação: voided_reason vale como motivo.
with u as (update public.field_records set status = 'voided', voided_reason = 'Parcela trocada'
           where client_id = '08900000-0000-4000-8000-0000000000a2' returning 1)
select is(count(*)::int, 1, 'anulação com voided_reason dispensa change_reason') from u;
select is(
  (select h.reason from public.change_history h join public.field_records r on r.id = h.record_id
    where r.client_id = '08900000-0000-4000-8000-0000000000a2' and h.operation = 'UPDATE'),
  'Parcela trocada', 'motivo da anulação gravado no histórico'
);

-- Imutabilidade para o cliente.
select throws_ok(
  $$ insert into public.change_history (table_name, record_id, operation) values ('field_records', gen_random_uuid(), 'UPDATE') $$,
  '42501', null, 'field não insere direto em change_history'
);
select throws_ok($$ update public.change_history set reason = 'x' $$, '42501', null, 'field não altera change_history');
select throws_ok($$ delete from public.change_history $$, '42501', null, 'field não exclui de change_history');

-- Leitura por ensaio.
select ok((select count(*) > 0 from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000a'), 'field lê histórico do ensaio atribuído');
select is((select count(*)::int from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000b'), 0, 'field não lê histórico de outro ensaio');
select is((select count(*)::int from public.change_history where table_name = 'profiles'), 0, 'field não lê histórico de perfis');

-- ---------------------------------------------------------------------------
-- home_office: lê o histórico do ensaio; não gera histórico de dado de campo; motivo vale em quality_flags
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"08000000-0000-4000-8000-000000000003","role":"authenticated"}';

select ok((select count(*) > 0 from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000a'), 'home_office lê histórico do ensaio atribuído');
select is((select count(*)::int from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000b'), 0, 'home_office não lê histórico de outro ensaio');
with u as (update public.field_records set value_numeric = 99, change_reason = 'tentativa' where id = '08700000-0000-4000-8000-0000000000a1' returning 1)
select is(count(*)::int, 0, 'home_office não altera dado de campo') from u;
select is((select count(*)::int from public.change_history where reason = 'tentativa'), 0, 'tentativa bloqueada não gera histórico');
select throws_like(
  $$ update public.quality_flags set status = 'checked' where id = '08740000-0000-4000-8000-0000000000a1' $$,
  '%Motivo obrigatório%', 'tratar conferência também exige motivo'
);
with u as (update public.quality_flags set status = 'checked', change_reason = 'Valor conferido' where id = '08740000-0000-4000-8000-0000000000a1' returning 1)
select is(count(*)::int, 1, 'home_office trata conferência com motivo') from u;
select is(
  (select author_id from public.change_history where table_name = 'quality_flags' and operation = 'UPDATE' and reason = 'Valor conferido'),
  '08000000-0000-4000-8000-000000000003'::uuid, 'histórico da conferência com autor = home_office'
);
select throws_ok($$ delete from public.change_history $$, '42501', null, 'home_office não exclui de change_history');

-- ---------------------------------------------------------------------------
-- field de outro ensaio, sem perfil e coordination
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"08000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select count(*)::int from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000a'), 0, 'field do ensaio B não lê histórico do A');
select ok((select count(*) > 0 from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000b'), 'field do ensaio B lê o histórico do B');

set local request.jwt.claims = '{"sub":"08000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.change_history), 0, 'sem perfil não lê histórico');

set local request.jwt.claims = '{"sub":"08000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok((select count(*) > 0 from public.change_history where trial_id = '08100000-0000-4000-8000-00000000000b'), 'coordination lê histórico de qualquer ensaio');
select ok((select count(*) > 0 from public.change_history where table_name = 'profiles'), 'coordination lê histórico de perfis');
with u as (update public.field_records set value_numeric = 31, change_reason = 'Revisão da coordenação'
           where id = '08700000-0000-4000-8000-0000000000b1' returning 1)
select is(count(*)::int, 1, 'coordination corrige com motivo') from u;
select is(
  (select author_id from public.change_history where reason = 'Revisão da coordenação'),
  '08000000-0000-4000-8000-000000000001'::uuid, 'histórico da correção com autor = coordination'
);
select set_config('app.change_reason', 'Entrada na equipe', true);
select lives_ok(
  $$ insert into public.trial_members (trial_id, user_id) values ('08100000-0000-4000-8000-00000000000b', '08000000-0000-4000-8000-000000000003') $$,
  'coordination atribui membro'
);
select results_eq(
  $$ select operation, author_id, reason from public.change_history
     where table_name = 'trial_members' and trial_id = '08100000-0000-4000-8000-00000000000b'
       and new_value ->> 'user_id' = '08000000-0000-4000-8000-000000000003' $$,
  $$ values ('INSERT'::text, '08000000-0000-4000-8000-000000000001'::uuid, 'Entrada na equipe'::text) $$,
  'atribuição registrada com autor e motivo'
);
select set_config('app.change_reason', '', true);
select throws_ok($$ update public.change_history set reason = 'x' $$, '42501', null, 'coordination não altera change_history');
select throws_ok($$ delete from public.change_history $$, '42501', null, 'coordination não exclui de change_history');
select throws_ok($$ truncate public.change_history $$, '42501', null, 'coordination não trunca change_history');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.change_history $$, '42501', null, 'anon não lê change_history');
reset role;

select * from finish();
rollback;
