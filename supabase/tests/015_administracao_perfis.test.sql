-- Tarefa 015: RPCs de administração (perfil e membros de ensaio) e garantia de ao menos uma coordenação.
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Fixtures próprias (uuid com prefixo 15...), sem depender do seed; tudo é desfeito no rollback.
-- Nenhum teste usa a chave secreta: os perfis são simulados com role authenticated + claims JWT.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem claims)
-- 01 coordination, 02 field, 03 home_office, 04 e 05 sem perfil, 06 coordination extra
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('15000000-0000-4000-8000-000000000001', 'coord.015@exemplo.test', '{"full_name":"Coord 015"}'),
  ('15000000-0000-4000-8000-000000000002', 'campo.015@exemplo.test', '{"full_name":"Campo 015"}'),
  ('15000000-0000-4000-8000-000000000003', 'escritorio.015@exemplo.test', '{"full_name":"Escritorio 015"}'),
  ('15000000-0000-4000-8000-000000000004', 'semperfil.015@exemplo.test', '{"full_name":"Sem perfil 015"}'),
  ('15000000-0000-4000-8000-000000000005', 'semperfil2.015@exemplo.test', '{"full_name":"Sem perfil 015 B"}'),
  ('15000000-0000-4000-8000-000000000006', 'coord2.015@exemplo.test', '{"full_name":"Coord 015 B"}');

update public.profiles set role = 'coordination' where id in ('15000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000006');
update public.profiles set role = 'field' where id = '15000000-0000-4000-8000-000000000002';
update public.profiles set role = 'home_office' where id = '15000000-0000-4000-8000-000000000003';

insert into public.trials (id, code) values
  ('15100000-0000-4000-8000-000000000001', 'T015-A'),
  ('15100000-0000-4000-8000-000000000002', 'T015-B');
insert into public.trial_members (trial_id, user_id) values
  ('15100000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and p.proname in ('admin_set_user_role', 'admin_add_trial_member', 'admin_remove_trial_member') $$,
  'RPCs de administração são SECURITY INVOKER (a RLS vale)'
);
select ok(not has_function_privilege('anon', 'public.admin_set_user_role(uuid, public.app_role, text)', 'execute'), 'anon não executa admin_set_user_role');
select ok(not has_function_privilege('anon', 'public.admin_add_trial_member(uuid, uuid, text)', 'execute'), 'anon não executa admin_add_trial_member');
select ok(not has_function_privilege('anon', 'public.admin_remove_trial_member(uuid, uuid, text)', 'execute'), 'anon não executa admin_remove_trial_member');
select ok(not has_function_privilege('authenticated', 'public.protect_last_coordination()', 'execute'), 'authenticated não executa protect_last_coordination');
select has_trigger('public', 'profiles', 'zz_protect_last_coordination', 'gatilho de última coordenação (UPDATE)');
select has_trigger('public', 'profiles', 'zz_protect_last_coordination_delete', 'gatilho de última coordenação (DELETE)');

-- ---------------------------------------------------------------------------
-- coordination
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000004', 'field', '  Liberação para o piloto  ') $$,
  'coordination atribui perfil com motivo'
);
select is(
  (select role from public.profiles where id = '15000000-0000-4000-8000-000000000004'),
  'field'::public.app_role,
  'perfil atribuído'
);
select lives_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000004', 'home_office', 'Mudou para o escritório') $$,
  'coordination altera perfil'
);
select lives_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000004', null, 'Saiu da equipe') $$,
  'coordination revoga perfil (role nula)'
);
select is(
  (select role from public.profiles where id = '15000000-0000-4000-8000-000000000004'),
  null::public.app_role,
  'perfil revogado'
);

select throws_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000005', 'field', '  ') $$,
  '22023', null, 'motivo vazio é rejeitado'
);
select throws_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000005', 'field', null) $$,
  '22023', null, 'motivo nulo é rejeitado'
);
select throws_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000005', 'admin', 'Motivo qualquer') $$,
  '22P02', null, 'valor de perfil inválido é rejeitado pelo enum'
);
select throws_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-0000000000ff', 'field', 'Pessoa inexistente') $$,
  'P0002', null, 'pessoa inexistente: não encontrada'
);
select throws_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000001', 'field', 'Quero sair da coordenação') $$,
  '42501', null, 'coordination não altera o próprio perfil'
);
select is(
  (select current_setting('app.change_reason', true)),
  '',
  'o motivo não fica pendurado na transação depois da RPC'
);

select lives_ok(
  $$ select public.admin_add_trial_member('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002', 'Reforço na avaliação') $$,
  'coordination atribui pessoa a ensaio'
);
select throws_ok(
  $$ select public.admin_add_trial_member('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002', 'De novo') $$,
  '23505', null, 'atribuição repetida é conflito'
);
select throws_ok(
  $$ select public.admin_add_trial_member('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000003', '') $$,
  '22023', null, 'atribuição sem motivo/contexto é rejeitada'
);
select lives_ok(
  $$ select public.admin_remove_trial_member('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002', 'Fim da avaliação') $$,
  'coordination retira pessoa do ensaio'
);
select throws_ok(
  $$ select public.admin_remove_trial_member('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002', 'Já retirada') $$,
  'P0002', null, 'retirar quem não está no ensaio: não encontrada'
);

-- Histórico (como postgres, para conferir as colunas carimbadas)
reset role;
set local request.jwt.claims = '';

select results_eq(
  $$ select author_id, reason, old_value, new_value from public.change_history
     where table_name = 'profiles' and record_id = '15000000-0000-4000-8000-000000000004'
     order by changed_at $$,
  $$ values
     ('15000000-0000-4000-8000-000000000001'::uuid, 'Liberação para o piloto', '{"role": null}'::jsonb, '{"role": "field"}'::jsonb),
     ('15000000-0000-4000-8000-000000000001'::uuid, 'Mudou para o escritório', '{"role": "field"}'::jsonb, '{"role": "home_office"}'::jsonb),
     ('15000000-0000-4000-8000-000000000001'::uuid, 'Saiu da equipe', '{"role": "home_office"}'::jsonb, '{"role": null}'::jsonb) $$,
  'cada mudança de perfil gera linha no histórico com autor, motivo, valor anterior e novo'
);
select results_eq(
  $$ select operation, author_id, reason from public.change_history
     where table_name = 'trial_members' and trial_id = '15100000-0000-4000-8000-000000000002'
     order by changed_at $$,
  $$ values
     ('INSERT', '15000000-0000-4000-8000-000000000001'::uuid, 'Reforço na avaliação'),
     ('DELETE', '15000000-0000-4000-8000-000000000001'::uuid, 'Fim da avaliação') $$,
  'atribuição e retirada geram linha no histórico com autor e motivo'
);
select is(
  (select count(*)::int from public.change_history where table_name = 'profiles' and record_id = '15000000-0000-4000-8000-000000000005'),
  0,
  'tentativas rejeitadas não geram histórico'
);

-- ---------------------------------------------------------------------------
-- field, home_office e sem perfil: negados pelo banco
-- ---------------------------------------------------------------------------
set local role authenticated;

set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000005', 'field', 'Tentativa') $$, '42501', null, 'field não atribui perfil');
select throws_ok($$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000002', 'coordination', 'Tentativa') $$, '42501', null, 'field não se promove pela RPC');
select throws_ok($$ select public.admin_add_trial_member('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002', 'Tentativa') $$, '42501', null, 'field não se atribui a ensaio');
select throws_ok($$ select public.admin_remove_trial_member('15100000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002', 'Tentativa') $$, '42501', null, 'field não retira membro');

set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000005', 'field', 'Tentativa') $$, '42501', null, 'home_office não atribui perfil');
select throws_ok($$ select public.admin_add_trial_member('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000003', 'Tentativa') $$, '42501', null, 'home_office não se atribui a ensaio');
select throws_ok($$ select public.admin_remove_trial_member('15100000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002', 'Tentativa') $$, '42501', null, 'home_office não retira membro');

set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok($$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000005', 'coordination', 'Tentativa') $$, '42501', null, 'sem perfil não se promove');
select throws_ok($$ select public.admin_add_trial_member('15100000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000005', 'Tentativa') $$, '42501', null, 'sem perfil não se atribui a ensaio');

reset role;
set local request.jwt.claims = '';
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000005', 'field', 'Tentativa') $$, '42501', null, 'anon não executa a RPC');

-- ---------------------------------------------------------------------------
-- Nunca sem coordination
-- ---------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

-- Duas coordenações (01 e 06): 01 rebaixa 06, sobra 01.
set local role authenticated;
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000006', 'field', 'Troca de função') $$,
  'coordination rebaixa outra coordenação quando sobra alguém'
);
-- 06 já não é coordination e não consegue rebaixar 01.
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000006","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_set_user_role('15000000-0000-4000-8000-000000000001', 'field', 'Revanche') $$,
  '42501', null, 'ex-coordenação não rebaixa ninguém'
);

-- Como sistema (SQL direto): deixa só 01 e tenta removê-lo.
reset role;
set local request.jwt.claims = '';
update public.profiles set role = 'field'
  where role = 'coordination' and id <> '15000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.profiles where role = 'coordination'), 1, 'fixture: só uma coordenação');
select throws_ok(
  $$ update public.profiles set role = 'field' where id = '15000000-0000-4000-8000-000000000001' $$,
  '23514', 'O sistema precisa ter ao menos uma pessoa na coordenação', 'nem o sistema rebaixa a última coordenação'
);
select throws_ok(
  $$ update public.profiles set role = null where id = '15000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'nem o sistema revoga a última coordenação'
);
select throws_ok(
  $$ delete from auth.users where id = '15000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'excluir a conta da última coordenação é bloqueado'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Coord 015 renomeada' where id = '15000000-0000-4000-8000-000000000001' $$,
  'outras colunas da última coordenação continuam editáveis'
);
select lives_ok(
  $$ update public.profiles set role = 'coordination' where id = '15000000-0000-4000-8000-000000000006' $$,
  'promover uma nova coordenação continua livre (bootstrap)'
);
select lives_ok(
  $$ update public.profiles set role = 'field' where id = '15000000-0000-4000-8000-000000000001' $$,
  'com outra coordenação, a anterior pode ser rebaixada'
);

select * from finish();
rollback;
