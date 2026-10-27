-- Tarefa 005: matriz de acesso de profiles, trials e trial_members.
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Fixtures próprias (uuid com prefixo 05...), sem depender do seed; tudo é desfeito no rollback.
-- Nenhum teste usa a chave secreta: os perfis são simulados com role authenticated + claims JWT.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem claims)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('05000000-0000-4000-8000-000000000001', 'coord.005@exemplo.test', '{"full_name":"Coord 005"}'),
  ('05000000-0000-4000-8000-000000000002', 'campo.005@exemplo.test', '{"full_name":"Campo 005"}'),
  ('05000000-0000-4000-8000-000000000003', 'escritorio.005@exemplo.test', '{"full_name":"Escritorio 005"}'),
  ('05000000-0000-4000-8000-000000000004', 'semperfil.005@exemplo.test', '{"full_name":"Sem perfil 005"}');

select is(
  (select count(*)::int from public.profiles
    where id::text like '05000000-%' and role is null),
  4,
  'criar usuário em auth.users gera profiles com role nula'
);

select is(
  (select full_name from public.profiles where id = '05000000-0000-4000-8000-000000000002'),
  'Campo 005',
  'nome copiado de raw_user_meta_data'
);

update public.profiles set role = 'coordination' where id = '05000000-0000-4000-8000-000000000001';
update public.profiles set role = 'field' where id = '05000000-0000-4000-8000-000000000002';
update public.profiles set role = 'home_office' where id = '05000000-0000-4000-8000-000000000003';

insert into public.trials (id, code, contractor, crop, location, design) values
  ('05100000-0000-4000-8000-000000000001', 'T005-A', 'Contratante ficticia', 'Soja', 'Area 1', 'dbc'),
  ('05100000-0000-4000-8000-000000000002', 'T005-B', 'Contratante ficticia', 'Milho', 'Area 2', 'dic');

-- field, home_office e o usuário sem perfil estão atribuídos só ao ensaio A.
insert into public.trial_members (trial_id, user_id) values
  ('05100000-0000-4000-8000-000000000001', '05000000-0000-4000-8000-000000000002'),
  ('05100000-0000-4000-8000-000000000001', '05000000-0000-4000-8000-000000000003'),
  ('05100000-0000-4000-8000-000000000001', '05000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------------
-- Estrutura: RLS, políticas e funções
-- ---------------------------------------------------------------------------
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
    where c.oid in ('public.profiles'::regclass, 'public.trials'::regclass, 'public.trial_members'::regclass)),
  'RLS ligada em profiles, trials e trial_members'
);

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public'
       and (btrim(coalesce(qual, '')) in ('true', '(true)') or btrim(coalesce(with_check, '')) in ('true', '(true)')) $$,
  'nenhuma política usa using (true) ou with check (true)'
);

select is_empty(
  $$ select p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%') $$,
  'toda função security definer tem search_path fixo'
);

select ok(not has_function_privilege('anon', 'public.has_trial_access(uuid)', 'execute'), 'anon não executa has_trial_access');
select ok(not has_function_privilege('anon', 'public.current_app_role()', 'execute'), 'anon não executa current_app_role');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'authenticated não executa handle_new_user');
select ok(has_function_privilege('authenticated', 'public.is_trial_member(uuid)', 'execute'), 'authenticated executa is_trial_member');

-- ---------------------------------------------------------------------------
-- coordination
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"05000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.current_app_role(), 'coordination'::public.app_role, 'current_app_role devolve coordination');
select is((select count(*)::int from public.trials where code like 'T005-%'), 2, 'coordination vê todos os ensaios');
select is((select count(*)::int from public.profiles where id::text like '05000000-%'), 4, 'coordination vê todos os perfis');
select is((select count(*)::int from public.trial_members where trial_id = '05100000-0000-4000-8000-000000000001'), 3, 'coordination vê os membros');

select lives_ok(
  $$ insert into public.trials (id, code) values ('05100000-0000-4000-8000-000000000003', 'T005-C') $$,
  'coordination cria ensaio'
);
with u as (update public.trials set crop = 'Feijao' where id = '05100000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 1, 'coordination edita ensaio') from u;
select lives_ok(
  $$ insert into public.trial_members (trial_id, user_id) values ('05100000-0000-4000-8000-000000000003', '05000000-0000-4000-8000-000000000002') $$,
  'coordination atribui membro'
);
with d as (delete from public.trial_members where trial_id = '05100000-0000-4000-8000-000000000003' returning 1)
select is(count(*)::int, 1, 'coordination remove membro') from d;
with d as (delete from public.trials where id = '05100000-0000-4000-8000-000000000003' returning 1)
select is(count(*)::int, 1, 'coordination exclui ensaio') from d;

with u as (update public.profiles set role = 'field' where id = '05000000-0000-4000-8000-000000000004' returning 1)
select is(count(*)::int, 1, 'coordination atribui perfil a outro usuário') from u;
with u as (update public.profiles set role = null where id = '05000000-0000-4000-8000-000000000004' returning 1)
select is(count(*)::int, 1, 'coordination revoga perfil') from u;

select throws_ok(
  $$ update public.profiles set role = 'field' where id = '05000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'coordination não altera o próprio role'
);

-- ---------------------------------------------------------------------------
-- field
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"05000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok($$ select count(*) from public.profiles $$, 'leitura de profiles sem recursão de política');
select is((select count(*)::int from public.trials where code like 'T005-%'), 1, 'field vê só o ensaio atribuído');
select is((select code from public.trials where code like 'T005-%'), 'T005-A', 'field vê o ensaio A');
select is((select count(*)::int from public.trials where id = '05100000-0000-4000-8000-000000000002'), 0, 'field não vê ensaio não atribuído');
select is((select count(*)::int from public.profiles where id::text like '05000000-%'), 1, 'field vê só o próprio perfil');
select is((select count(*)::int from public.trial_members where trial_id = '05100000-0000-4000-8000-000000000001'), 3, 'field vê a equipe do ensaio atribuído');

select throws_ok(
  $$ insert into public.trials (code) values ('T005-X') $$,
  '42501', null, 'field não cria ensaio'
);
with u as (update public.trials set crop = 'x' where code like 'T005-%' returning 1)
select is(count(*)::int, 0, 'field não edita ensaio') from u;
with d as (delete from public.trials where code like 'T005-%' returning 1)
select is(count(*)::int, 0, 'field não exclui ensaio') from d;

select throws_ok(
  $$ insert into public.trial_members (trial_id, user_id) values ('05100000-0000-4000-8000-000000000002', '05000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'field não se atribui a outro ensaio'
);
with u as (update public.trial_members set user_id = '05000000-0000-4000-8000-000000000002' where trial_id = '05100000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'field não altera trial_members') from u;
with d as (delete from public.trial_members where trial_id = '05100000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'field não remove trial_members') from d;

select throws_ok(
  $$ update public.profiles set role = 'coordination' where id = '05000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'field não se auto-promove'
);
with u as (update public.profiles set full_name = 'x' where id = '05000000-0000-4000-8000-000000000003' returning 1)
select is(count(*)::int, 0, 'field não edita perfil alheio') from u;
with u as (update public.profiles set role = 'field' where id = '05000000-0000-4000-8000-000000000004' returning 1)
select is(count(*)::int, 0, 'field não atribui perfil a outro usuário') from u;
with u as (update public.profiles set full_name = 'Campo 005 editado' where id = '05000000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 1, 'field edita o próprio nome') from u;
select throws_ok(
  $$ update public.profiles set email = 'outro@exemplo.test' where id = '05000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'field não altera o próprio e-mail'
);
select throws_ok(
  $$ insert into public.profiles (id, email, role) values ('05000000-0000-4000-8000-000000000009', 'x@exemplo.test', 'coordination') $$,
  '42501', null, 'field não insere perfil'
);
select throws_ok(
  $$ delete from public.profiles where id = '05000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'field não exclui perfil'
);

-- ---------------------------------------------------------------------------
-- home_office
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"05000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.trials where code like 'T005-%'), 1, 'home_office vê só o ensaio atribuído');
select is((select count(*)::int from public.trials where id = '05100000-0000-4000-8000-000000000002'), 0, 'home_office não vê ensaio não atribuído');
select is((select count(*)::int from public.profiles where id::text like '05000000-%'), 1, 'home_office vê só o próprio perfil');
select throws_ok(
  $$ insert into public.trials (code) values ('T005-Y') $$,
  '42501', null, 'home_office não cria ensaio'
);
with u as (update public.trials set crop = 'x' where code like 'T005-%' returning 1)
select is(count(*)::int, 0, 'home_office não edita ensaio') from u;
with d as (delete from public.trials where code like 'T005-%' returning 1)
select is(count(*)::int, 0, 'home_office não exclui ensaio') from d;
select throws_ok(
  $$ insert into public.trial_members (trial_id, user_id) values ('05100000-0000-4000-8000-000000000002', '05000000-0000-4000-8000-000000000003') $$,
  '42501', null, 'home_office não atribui membro'
);
with d as (delete from public.trial_members where trial_id = '05100000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'home_office não remove trial_members') from d;
select throws_ok(
  $$ update public.profiles set role = 'coordination' where id = '05000000-0000-4000-8000-000000000003' $$,
  '42501', null, 'home_office não se auto-promove'
);

-- ---------------------------------------------------------------------------
-- Usuário sem perfil (mesmo atribuído ao ensaio A)
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"05000000-0000-4000-8000-000000000004","role":"authenticated"}';

select is(public.current_app_role(), null::public.app_role, 'usuário sem perfil tem role nula');
select is((select count(*)::int from public.trials where code like 'T005-%'), 0, 'sem perfil não lê ensaios');
select is((select count(*)::int from public.trial_members), 0, 'sem perfil não lê trial_members');
select is((select count(*)::int from public.profiles), 1, 'sem perfil lê só o próprio perfil');
select throws_ok(
  $$ insert into public.trials (code) values ('T005-Z') $$,
  '42501', null, 'sem perfil não cria ensaio'
);
select throws_ok(
  $$ insert into public.trial_members (trial_id, user_id) values ('05100000-0000-4000-8000-000000000002', '05000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'sem perfil não se atribui a ensaio'
);
select throws_ok(
  $$ update public.profiles set role = 'coordination' where id = '05000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'sem perfil não se auto-promove'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.trials $$, '42501', null, 'anon não lê trials');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon não lê profiles');
select throws_ok($$ select * from public.trial_members $$, '42501', null, 'anon não lê trial_members');
reset role;

select * from finish();
rollback;
