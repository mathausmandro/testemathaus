-- Tarefa 006: matriz de acesso das tabelas do protocolo e restrições de integridade.
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Fixtures próprias (prefixo 06...), desfeitas no rollback. Perfis simulados por claims JWT, sem chave secreta.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- Auxiliares de teste (SECURITY INVOKER: rodam com o papel corrente, então a RLS vale).
create schema test_helpers;
grant usage on schema test_helpers to authenticated, anon;

create function test_helpers.count_rows(p_table text, p_trial uuid) returns int
language plpgsql as $$
declare n int;
begin
  execute format('select count(*)::int from public.%I where trial_id = $1', p_table) into n using p_trial;
  return n;
end $$;

create function test_helpers.touch_rows(p_table text, p_trial uuid) returns int
language plpgsql as $$
declare n int;
begin
  execute format('with u as (update public.%I set updated_at = updated_at where trial_id = $1 returning 1) select count(*)::int from u', p_table)
    into n using p_trial;
  return n;
end $$;

create function test_helpers.delete_rows(p_table text, p_trial uuid) returns int
language plpgsql as $$
declare n int;
begin
  execute format('with d as (delete from public.%I where trial_id = $1 returning 1) select count(*)::int from d', p_table)
    into n using p_trial;
  return n;
end $$;

grant execute on all functions in schema test_helpers to authenticated, anon;

create temporary table protocol_tables (name text) on commit drop;
insert into protocol_tables values
  ('factors'), ('factor_levels'), ('treatments'), ('treatment_factor_levels'),
  ('plots'), ('assessment_variables'), ('planned_assessments');
grant select on protocol_tables to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('06000000-0000-4000-8000-000000000001', 'coord.006@exemplo.test'),
  ('06000000-0000-4000-8000-000000000002', 'campo.006@exemplo.test'),
  ('06000000-0000-4000-8000-000000000003', 'escritorio.006@exemplo.test'),
  ('06000000-0000-4000-8000-000000000004', 'semperfil.006@exemplo.test');
update public.profiles set role = 'coordination' where id = '06000000-0000-4000-8000-000000000001';
update public.profiles set role = 'field' where id = '06000000-0000-4000-8000-000000000002';
update public.profiles set role = 'home_office' where id = '06000000-0000-4000-8000-000000000003';

-- A: atribuído a field, home_office e ao sem perfil. B: ninguém atribuído.
insert into public.trials (id, code, design) values
  ('06100000-0000-4000-8000-00000000000a', 'T006-A', 'factorial'),
  ('06100000-0000-4000-8000-00000000000b', 'T006-B', 'split_plot');
insert into public.trial_members (trial_id, user_id) values
  ('06100000-0000-4000-8000-00000000000a', '06000000-0000-4000-8000-000000000002'),
  ('06100000-0000-4000-8000-00000000000a', '06000000-0000-4000-8000-000000000003'),
  ('06100000-0000-4000-8000-00000000000a', '06000000-0000-4000-8000-000000000004');

-- Uma linha por tabela em cada ensaio (sufixo a = ensaio A, b = ensaio B).
insert into public.factors (id, trial_id, name) values
  ('06200000-0000-4000-8000-00000000000a', '06100000-0000-4000-8000-00000000000a', 'Fator 1'),
  ('06200000-0000-4000-8000-00000000000b', '06100000-0000-4000-8000-00000000000b', 'Fator 1');
insert into public.factor_levels (id, trial_id, factor_id, name) values
  ('06210000-0000-4000-8000-00000000000a', '06100000-0000-4000-8000-00000000000a', '06200000-0000-4000-8000-00000000000a', 'Nivel 1'),
  ('06210000-0000-4000-8000-00000000000b', '06100000-0000-4000-8000-00000000000b', '06200000-0000-4000-8000-00000000000b', 'Nivel 1');
insert into public.treatments (id, trial_id, number, name) values
  ('06300000-0000-4000-8000-00000000000a', '06100000-0000-4000-8000-00000000000a', 1, 'T1'),
  ('06300000-0000-4000-8000-00000000000b', '06100000-0000-4000-8000-00000000000b', 1, 'T1');
insert into public.treatment_factor_levels (trial_id, treatment_id, factor_level_id) values
  ('06100000-0000-4000-8000-00000000000a', '06300000-0000-4000-8000-00000000000a', '06210000-0000-4000-8000-00000000000a'),
  ('06100000-0000-4000-8000-00000000000b', '06300000-0000-4000-8000-00000000000b', '06210000-0000-4000-8000-00000000000b');
insert into public.plots (id, trial_id, number, block, treatment_id) values
  ('06400000-0000-4000-8000-00000000000a', '06100000-0000-4000-8000-00000000000a', 101, 1, '06300000-0000-4000-8000-00000000000a'),
  ('06400000-0000-4000-8000-00000000000b', '06100000-0000-4000-8000-00000000000b', 101, 1, '06300000-0000-4000-8000-00000000000b');
insert into public.assessment_variables (id, trial_id, name, min_value, max_value) values
  ('06500000-0000-4000-8000-00000000000a', '06100000-0000-4000-8000-00000000000a', 'Var 1', 0, 10),
  ('06500000-0000-4000-8000-00000000000b', '06100000-0000-4000-8000-00000000000b', 'Var 1', 0, 10);
insert into public.planned_assessments (trial_id, variable_id, days_after, reference_event) values
  ('06100000-0000-4000-8000-00000000000a', '06500000-0000-4000-8000-00000000000a', 7, 'planting'),
  ('06100000-0000-4000-8000-00000000000b', '06500000-0000-4000-8000-00000000000b', 7, 'application');

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select ok(c.relrowsecurity, format('RLS ligada em %s', t.name))
from protocol_tables t join pg_class c on c.oid = ('public.' || t.name)::regclass;

select is_empty(
  $$ select table_name, column_name from information_schema.columns
     where table_schema = 'public'
       and table_name in ('factors','factor_levels','treatments','treatment_factor_levels','plots','assessment_variables','planned_assessments')
       and data_type = 'timestamp without time zone' $$,
  'nenhuma coluna timestamp sem fuso nas tabelas do protocolo'
);

-- ---------------------------------------------------------------------------
-- Integridade
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.plots (trial_id, number, treatment_id)
     values ('06100000-0000-4000-8000-00000000000a', 999, '06300000-0000-4000-8000-00000000000b') $$,
  '23503', null, 'parcela não referencia tratamento de outro ensaio'
);
select throws_ok(
  $$ insert into public.plots (trial_id, number, main_plot_id)
     values ('06100000-0000-4000-8000-00000000000a', 998, '06400000-0000-4000-8000-00000000000b') $$,
  '23503', null, 'parcela principal deve ser do mesmo ensaio'
);
select throws_ok(
  $$ insert into public.assessment_variables (trial_id, name, min_value, max_value)
     values ('06100000-0000-4000-8000-00000000000a', 'Faixa invertida', 10, 1) $$,
  '23514', null, 'variável com mínimo maior que máximo é rejeitada'
);
select throws_ok(
  $$ insert into public.factor_levels (trial_id, factor_id, name)
     values ('06100000-0000-4000-8000-00000000000a', '06200000-0000-4000-8000-00000000000b', 'X') $$,
  '23503', null, 'nível não referencia fator de outro ensaio'
);
select throws_ok(
  $$ insert into public.planned_assessments (trial_id, variable_id, days_after)
     values ('06100000-0000-4000-8000-00000000000a', '06500000-0000-4000-8000-00000000000a', 7) $$,
  '23514', null, 'momento exige dias e evento de referência juntos'
);
select throws_ok(
  $$ insert into public.treatments (trial_id, number, name) values ('06100000-0000-4000-8000-00000000000a', 1, 'Repetido') $$,
  '23505', null, 'número do tratamento é único no ensaio'
);

-- ---------------------------------------------------------------------------
-- coordination: lê e grava em todos os ensaios
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"06000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(test_helpers.count_rows(t.name, '06100000-0000-4000-8000-00000000000b'), 1, format('coordination lê %s de qualquer ensaio', t.name))
from protocol_tables t;
select is(test_helpers.touch_rows(t.name, '06100000-0000-4000-8000-00000000000b'), 1, format('coordination atualiza %s', t.name))
from protocol_tables t;

select lives_ok($$ insert into public.factors (trial_id, name) values ('06100000-0000-4000-8000-00000000000b', 'Fator novo') $$, 'coordination insere factors');
select lives_ok($$ insert into public.treatments (trial_id, number, name) values ('06100000-0000-4000-8000-00000000000b', 2, 'T2') $$, 'coordination insere treatments');
select lives_ok($$ insert into public.plots (trial_id, number) values ('06100000-0000-4000-8000-00000000000b', 102) $$, 'coordination insere plots');
select lives_ok($$ insert into public.assessment_variables (trial_id, name) values ('06100000-0000-4000-8000-00000000000b', 'Var 2') $$, 'coordination insere assessment_variables');
with d as (delete from public.plots where trial_id = '06100000-0000-4000-8000-00000000000b' and number = 102 returning 1)
select is(count(*)::int, 1, 'coordination exclui parcela sem registro de campo') from d;

-- ---------------------------------------------------------------------------
-- field e home_office: leem só o ensaio atribuído; não gravam
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"06000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(test_helpers.count_rows(t.name, '06100000-0000-4000-8000-00000000000a'), 1, format('field lê %s do ensaio atribuído', t.name))
from protocol_tables t;
select is(test_helpers.count_rows(t.name, '06100000-0000-4000-8000-00000000000b'), 0, format('field não lê %s de outro ensaio', t.name))
from protocol_tables t;
select is(test_helpers.touch_rows(t.name, '06100000-0000-4000-8000-00000000000a'), 0, format('field não atualiza %s', t.name))
from protocol_tables t;
select is(test_helpers.delete_rows(t.name, '06100000-0000-4000-8000-00000000000a'), 0, format('field não exclui %s', t.name))
from protocol_tables t;
select throws_ok($$ insert into public.factors (trial_id, name) values ('06100000-0000-4000-8000-00000000000a', 'F') $$, '42501', null, 'field não insere factors');
select throws_ok($$ insert into public.factor_levels (trial_id, factor_id, name) values ('06100000-0000-4000-8000-00000000000a', '06200000-0000-4000-8000-00000000000a', 'N') $$, '42501', null, 'field não insere factor_levels');
select throws_ok($$ insert into public.treatments (trial_id, number, name) values ('06100000-0000-4000-8000-00000000000a', 5, 'T') $$, '42501', null, 'field não insere treatments');
select throws_ok($$ insert into public.treatment_factor_levels (trial_id, treatment_id, factor_level_id) values ('06100000-0000-4000-8000-00000000000a', '06300000-0000-4000-8000-00000000000a', '06210000-0000-4000-8000-00000000000a') $$, '42501', null, 'field não insere treatment_factor_levels');
select throws_ok($$ insert into public.plots (trial_id, number) values ('06100000-0000-4000-8000-00000000000a', 500) $$, '42501', null, 'field não insere plots');
select throws_ok($$ insert into public.assessment_variables (trial_id, name) values ('06100000-0000-4000-8000-00000000000a', 'V') $$, '42501', null, 'field não insere assessment_variables');
select throws_ok($$ insert into public.planned_assessments (trial_id, variable_id) values ('06100000-0000-4000-8000-00000000000a', '06500000-0000-4000-8000-00000000000a') $$, '42501', null, 'field não insere planned_assessments');

set local request.jwt.claims = '{"sub":"06000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is(test_helpers.count_rows(t.name, '06100000-0000-4000-8000-00000000000a'), 1, format('home_office lê %s do ensaio atribuído', t.name))
from protocol_tables t;
select is(test_helpers.count_rows(t.name, '06100000-0000-4000-8000-00000000000b'), 0, format('home_office não lê %s de outro ensaio', t.name))
from protocol_tables t;
select is(test_helpers.touch_rows(t.name, '06100000-0000-4000-8000-00000000000a'), 0, format('home_office não atualiza %s', t.name))
from protocol_tables t;
select is(test_helpers.delete_rows(t.name, '06100000-0000-4000-8000-00000000000a'), 0, format('home_office não exclui %s', t.name))
from protocol_tables t;
select throws_ok($$ insert into public.treatments (trial_id, number, name) values ('06100000-0000-4000-8000-00000000000a', 6, 'T') $$, '42501', null, 'home_office não insere treatments');
select throws_ok($$ insert into public.plots (trial_id, number) values ('06100000-0000-4000-8000-00000000000a', 501) $$, '42501', null, 'home_office não insere plots');
select throws_ok($$ insert into public.assessment_variables (trial_id, name) values ('06100000-0000-4000-8000-00000000000a', 'V') $$, '42501', null, 'home_office não insere assessment_variables');
select throws_ok($$ insert into public.planned_assessments (trial_id, variable_id) values ('06100000-0000-4000-8000-00000000000a', '06500000-0000-4000-8000-00000000000a') $$, '42501', null, 'home_office não insere planned_assessments');

-- ---------------------------------------------------------------------------
-- Sem perfil (atribuído ao ensaio A) e anon: nada
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"06000000-0000-4000-8000-000000000004","role":"authenticated"}';

select is(test_helpers.count_rows(t.name, '06100000-0000-4000-8000-00000000000a'), 0, format('sem perfil não lê %s', t.name))
from protocol_tables t;
select throws_ok($$ insert into public.plots (trial_id, number) values ('06100000-0000-4000-8000-00000000000a', 502) $$, '42501', null, 'sem perfil não insere plots');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.plots $$, '42501', null, 'anon não lê plots');
select throws_ok($$ select * from public.treatments $$, '42501', null, 'anon não lê treatments');
reset role;

select * from finish();
rollback;
