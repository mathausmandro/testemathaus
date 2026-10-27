-- Tarefa 009: preferências, log de avisos, inscrições de push e tokens do feed iCal.
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Fixtures próprias (prefixo 09...), desfeitas no rollback. Perfis simulados por claims JWT, sem chave secreta.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem claims)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('09000000-0000-4000-8000-000000000001', 'coord.009@exemplo.test'),
  ('09000000-0000-4000-8000-000000000002', 'campo.009@exemplo.test'),
  ('09000000-0000-4000-8000-000000000003', 'escritorio.009@exemplo.test'),
  ('09000000-0000-4000-8000-000000000004', 'semperfil.009@exemplo.test'),
  ('09000000-0000-4000-8000-000000000005', 'campob.009@exemplo.test');
update public.profiles set role = 'coordination' where id = '09000000-0000-4000-8000-000000000001';
update public.profiles set role = 'field' where id in ('09000000-0000-4000-8000-000000000002', '09000000-0000-4000-8000-000000000005');
update public.profiles set role = 'home_office' where id = '09000000-0000-4000-8000-000000000003';

insert into public.trials (id, code) values ('09100000-0000-4000-8000-000000000001', 'T009-A');

-- Linhas de outra pessoa (campo B), para testar propriedade dos dados.
insert into public.notification_preferences (id, user_id, push_enabled) values
  ('09200000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000005', true);
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth_secret) values
  ('09300000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000005',
   'https://push.exemplo.test/b', 'chave-publica-b', 'segredo-b');
insert into public.calendar_feed_tokens (id, user_id, token_hash, label) values
  ('09400000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000005',
   encode(sha256(convert_to('token-ficticio-campo-b', 'UTF8')), 'hex'), 'Celular B');
insert into public.notification_log (id, user_id, trial_id, channel, kind, status, dedupe_key) values
  ('09500000-0000-4000-8000-000000000002', '09000000-0000-4000-8000-000000000002',
   '09100000-0000-4000-8000-000000000001', 'push', 'assessment_due', 'sent', 'teste-009-campo'),
  ('09500000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000005',
   '09100000-0000-4000-8000-000000000001', 'email', 'assessment_due', 'sent', 'teste-009-campob');

-- Token em claro do teste: só vive nesta variável de sessão, nunca em tabela.
select set_config('test.feed_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), true);

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.notification_preferences'::regclass, 'public.push_subscriptions'::regclass,
    'public.calendar_feed_tokens'::regclass, 'public.notification_log'::regclass)),
  'RLS ligada nas quatro tabelas'
);
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('notification_preferences', 'push_subscriptions', 'calendar_feed_tokens', 'notification_log')
       and (btrim(coalesce(qual, '')) in ('true', '(true)') or btrim(coalesce(with_check, '')) in ('true', '(true)')) $$,
  'nenhuma política using (true) nas tabelas de avisos'
);
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and tablename = 'notification_log' and cmd <> 'SELECT' $$,
  'notification_log não tem política de escrita'
);
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and tablename = 'calendar_feed_tokens' and cmd in ('DELETE', 'ALL') $$,
  'calendar_feed_tokens não tem política de exclusão'
);
select ok(not has_table_privilege('authenticated', 'public.notification_log', 'insert'), 'authenticated sem INSERT em notification_log');
select ok(not has_table_privilege('authenticated', 'public.notification_log', 'update'), 'authenticated sem UPDATE em notification_log');
select ok(not has_table_privilege('authenticated', 'public.notification_log', 'delete'), 'authenticated sem DELETE em notification_log');
select ok(not has_column_privilege('authenticated', 'public.calendar_feed_tokens', 'token_hash', 'select'), 'token_hash ilegível para authenticated');
select ok(not has_column_privilege('authenticated', 'public.calendar_feed_tokens', 'token_hash', 'update'), 'token_hash imutável para authenticated');
select ok(not has_column_privilege('authenticated', 'public.calendar_feed_tokens', 'user_id', 'insert'), 'authenticated não escolhe o dono do token');
select ok(not has_table_privilege('authenticated', 'public.calendar_feed_tokens', 'delete'), 'authenticated sem DELETE em calendar_feed_tokens');
select ok(
  not has_table_privilege('anon', 'public.notification_preferences', 'select')
  and not has_table_privilege('anon', 'public.push_subscriptions', 'select')
  and not has_table_privilege('anon', 'public.calendar_feed_tokens', 'select')
  and not has_table_privilege('anon', 'public.notification_log', 'select'),
  'anon sem acesso às tabelas de avisos'
);
select is_empty(
  $$ select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'calendar_feed_tokens'
       and column_name like '%token%' and column_name <> 'token_hash' $$,
  'calendar_feed_tokens não tem coluna de token em claro'
);
select is_empty(
  $$ select table_name || '.' || column_name from information_schema.columns
     where table_schema = 'public'
       and table_name in ('notification_preferences', 'push_subscriptions', 'calendar_feed_tokens', 'notification_log')
       and data_type in ('timestamp without time zone', 'date', 'time without time zone') $$,
  'todas as datas das tabelas de avisos são timestamptz'
);
select is_empty(
  $$ select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'notification_log'
       and column_name in ('email', 'endpoint', 'message', 'body', 'title', 'full_name') $$,
  'notification_log não guarda e-mail, endpoint nem texto da mensagem'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'notification_log_user_sent_idx')
  and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'notification_log_sent_idx')
  and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'calendar_feed_tokens_user_idx'),
  'índices por usuário e por data'
);
select throws_ok(
  $$ insert into public.calendar_feed_tokens (user_id, token_hash) values ('09000000-0000-4000-8000-000000000002', 'token-em-claro') $$,
  '23514', null, 'token_hash só aceita SHA-256 em hexadecimal (token em claro é recusado)'
);

-- ---------------------------------------------------------------------------
-- field
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"09000000-0000-4000-8000-000000000002","role":"authenticated"}';

-- preferências
select lives_ok(
  $$ insert into public.notification_preferences (push_enabled, email_enabled, lead_time_hours) values (true, false, 24) $$,
  'field cria as próprias preferências'
);
select is((select user_id from public.notification_preferences), '09000000-0000-4000-8000-000000000002'::uuid, 'field vê só as próprias preferências');
with u as (update public.notification_preferences set email_enabled = true where user_id = '09000000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 1, 'field altera as próprias preferências') from u;
with u as (update public.notification_preferences set push_enabled = false where user_id = '09000000-0000-4000-8000-000000000005' returning 1)
select is(count(*)::int, 0, 'field não altera preferências de outra pessoa') from u;
with d as (delete from public.notification_preferences where user_id = '09000000-0000-4000-8000-000000000005' returning 1)
select is(count(*)::int, 0, 'field não exclui preferências de outra pessoa') from d;
select throws_ok(
  $$ insert into public.notification_preferences (user_id) values ('09000000-0000-4000-8000-000000000005') $$,
  '42501', null, 'field não cria preferências em nome de outra pessoa'
);

-- push
select lives_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth_secret) values ('https://push.exemplo.test/campo', 'chave', 'segredo') $$,
  'field registra a própria inscrição push'
);
select is((select count(*)::int from public.push_subscriptions), 1, 'field vê só a própria inscrição push');
with u as (update public.push_subscriptions set p256dh = 'outra' where user_id = '09000000-0000-4000-8000-000000000005' returning 1)
select is(count(*)::int, 0, 'field não altera inscrição push alheia') from u;
with d as (delete from public.push_subscriptions where user_id = '09000000-0000-4000-8000-000000000005' returning 1)
select is(count(*)::int, 0, 'field não exclui inscrição push alheia') from d;
select throws_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret) values ('09000000-0000-4000-8000-000000000005', 'https://push.exemplo.test/x', 'k', 's') $$,
  '42501', null, 'field não registra push em nome de outra pessoa'
);
with d as (delete from public.push_subscriptions where endpoint = 'https://push.exemplo.test/campo' returning 1)
select is(count(*)::int, 1, 'field cancela a própria inscrição push') from d;

-- tokens do feed: o servidor gera o token e envia só o hash
select lives_ok(
  $$ insert into public.calendar_feed_tokens (label, token_hash)
     values ('Agenda do celular', encode(sha256(convert_to(current_setting('test.feed_token'), 'UTF8')), 'hex')) $$,
  'field cria token do feed enviando só o hash'
);
select is(
  (select count(*)::int from public.calendar_feed_tokens where user_id = '09000000-0000-4000-8000-000000000002'),
  1, 'field vê os metadados do próprio token'
);
select is(
  (select count(*)::int from public.calendar_feed_tokens where user_id = '09000000-0000-4000-8000-000000000005'),
  0, 'field não vê tokens de outra pessoa'
);
select throws_ok($$ select token_hash from public.calendar_feed_tokens $$, '42501', null, 'field não lê token_hash, nem o próprio');
select throws_ok(
  $$ insert into public.calendar_feed_tokens (user_id, token_hash) values ('09000000-0000-4000-8000-000000000005', repeat('a', 64)) $$,
  '42501', null, 'field não cria token em nome de outra pessoa'
);
with u as (update public.calendar_feed_tokens set revoked_at = now() where user_id = '09000000-0000-4000-8000-000000000005' returning 1)
select is(count(*)::int, 0, 'field não revoga token alheio') from u;
select throws_ok($$ delete from public.calendar_feed_tokens $$, '42501', null, 'field não exclui token (só revoga)');

-- log
select is((select count(*)::int from public.notification_log), 1, 'field lê só o próprio log de avisos');
select throws_ok(
  $$ insert into public.notification_log (user_id, channel, kind, status, dedupe_key) values ('09000000-0000-4000-8000-000000000002', 'push', 'x', 'sent', 'forjado') $$,
  '42501', null, 'field não escreve em notification_log'
);
select throws_ok($$ update public.notification_log set status = 'failed' $$, '42501', null, 'field não altera notification_log');
select throws_ok($$ delete from public.notification_log $$, '42501', null, 'field não exclui de notification_log');

-- ---------------------------------------------------------------------------
-- Hash do token: o texto original não existe em nenhuma tabela do banco
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.calendar_feed_tokens
    where token_hash = encode(sha256(convert_to(current_setting('test.feed_token'), 'UTF8')), 'hex')),
  1, 'o hash do token foi gravado'
);

create function pg_temp.tables_containing(p_text text) returns text[]
language plpgsql as $$
declare
  r record;
  n integer;
  found text[] := '{}';
begin
  for r in
    select n2.nspname, c.relname
    from pg_class c join pg_namespace n2 on n2.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n2.nspname = 'public'
  loop
    execute format('select count(*) from %I.%I t where strpos(t::text, $1) > 0', r.nspname, r.relname)
      into n using p_text;
    if n > 0 then
      found := found || (r.nspname || '.' || r.relname);
    end if;
  end loop;
  return found;
end;
$$;

select is(pg_temp.tables_containing(current_setting('test.feed_token')), '{}'::text[], 'o token em claro não existe em nenhuma tabela do schema public');

-- ---------------------------------------------------------------------------
-- home_office
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"09000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.notification_preferences), 0, 'home_office não vê preferências alheias');
select is((select count(*)::int from public.push_subscriptions), 0, 'home_office não vê inscrições push alheias');
select is((select count(*)::int from public.calendar_feed_tokens), 0, 'home_office não vê tokens alheios');
select is((select count(*)::int from public.notification_log), 0, 'home_office não vê log alheio');
select lives_ok(
  $$ insert into public.notification_preferences (lead_time_hours) values (48) $$,
  'home_office cria as próprias preferências'
);
select throws_ok(
  $$ insert into public.notification_log (user_id, channel, kind, status, dedupe_key) values ('09000000-0000-4000-8000-000000000003', 'email', 'x', 'sent', 'forjado-ho') $$,
  '42501', null, 'home_office não escreve em notification_log'
);

-- ---------------------------------------------------------------------------
-- coordination
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"09000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.notification_preferences), 0, 'coordination não lê preferências de outras pessoas');
select is((select count(*)::int from public.push_subscriptions), 0, 'coordination não lê inscrições push de outras pessoas');
select is(
  (select count(*)::int from public.calendar_feed_tokens where user_id in ('09000000-0000-4000-8000-000000000002', '09000000-0000-4000-8000-000000000005')),
  2, 'coordination vê os metadados dos tokens (para revogar)'
);
select throws_ok($$ select token_hash from public.calendar_feed_tokens $$, '42501', null, 'coordination não lê o hash do token');
select throws_ok(
  $$ update public.calendar_feed_tokens set label = 'renomeado' where user_id = '09000000-0000-4000-8000-000000000005' $$,
  '42501', null, 'coordination não altera outros campos de token alheio'
);
with u as (update public.calendar_feed_tokens set revoked_at = now() where user_id = '09000000-0000-4000-8000-000000000005' returning revoked_by)
select is((select revoked_by from u), '09000000-0000-4000-8000-000000000001'::uuid, 'coordination revoga token alheio e fica registrada') ;
with u as (update public.push_subscriptions set p256dh = 'x' returning 1)
select is(count(*)::int, 0, 'coordination não altera inscrições push alheias') from u;
select is((select count(*)::int from public.notification_log where id::text like '09500000-%'), 2, 'coordination lê o log de avisos de todos');
select throws_ok(
  $$ insert into public.notification_log (user_id, channel, kind, status, dedupe_key) values ('09000000-0000-4000-8000-000000000001', 'push', 'x', 'sent', 'forjado-coord') $$,
  '42501', null, 'coordination não escreve em notification_log'
);
select throws_ok($$ update public.notification_log set status = 'failed' $$, '42501', null, 'coordination não altera notification_log');
select throws_ok($$ delete from public.calendar_feed_tokens $$, '42501', null, 'coordination não exclui tokens');

-- ---------------------------------------------------------------------------
-- field: revogação própria é definitiva
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"09000000-0000-4000-8000-000000000002","role":"authenticated"}';

with u as (update public.calendar_feed_tokens set revoked_at = now() returning revoked_by)
select is((select revoked_by from u), '09000000-0000-4000-8000-000000000002'::uuid, 'field revoga o próprio token');
select throws_ok(
  $$ update public.calendar_feed_tokens set revoked_at = null $$,
  '42501', null, 'token revogado não volta a valer'
);

-- campo B não reativa o token revogado pela coordenação
set local request.jwt.claims = '{"sub":"09000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$ update public.calendar_feed_tokens set revoked_at = null $$,
  '42501', null, 'dono não reativa token revogado pela coordenação'
);

-- ---------------------------------------------------------------------------
-- Usuário sem perfil
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"09000000-0000-4000-8000-000000000004","role":"authenticated"}';

select is((select count(*)::int from public.notification_preferences), 0, 'sem perfil não vê preferências alheias');
select is((select count(*)::int from public.push_subscriptions), 0, 'sem perfil não vê inscrições alheias');
select is((select count(*)::int from public.calendar_feed_tokens), 0, 'sem perfil não vê tokens alheios');
select is((select count(*)::int from public.notification_log), 0, 'sem perfil não vê log alheio');
select throws_ok(
  $$ insert into public.notification_preferences (push_enabled) values (true) $$,
  '42501', null, 'sem perfil não grava preferências'
);
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth_secret) values ('https://push.exemplo.test/sp', 'k', 's') $$,
  '42501', null, 'sem perfil não registra push'
);
select throws_ok(
  $$ insert into public.calendar_feed_tokens (token_hash) values (repeat('b', 64)) $$,
  '42501', null, 'sem perfil não cria token do feed'
);
with u as (update public.push_subscriptions set p256dh = 'x' returning 1)
select is(count(*)::int, 0, 'sem perfil não altera inscrições') from u;

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.notification_preferences $$, '42501', null, 'anon não lê notification_preferences');
select throws_ok($$ select * from public.push_subscriptions $$, '42501', null, 'anon não lê push_subscriptions');
select throws_ok($$ select id from public.calendar_feed_tokens $$, '42501', null, 'anon não lê calendar_feed_tokens');
select throws_ok($$ select * from public.notification_log $$, '42501', null, 'anon não lê notification_log');
reset role;

select * from finish();
rollback;
