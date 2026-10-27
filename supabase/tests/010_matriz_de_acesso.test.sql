-- Tarefa 010: matriz de acesso completa (perfil x tabela x operação x escopo) e regras transversais.
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Documentação da matriz: docs/seguranca/matriz-acesso.md (cada célula = uma linha em test_helpers.rules).
--
-- Como funciona:
-- - Fixtures próprias (ids 10..., 1010..., a0..), criadas aqui e desfeitas no rollback; nada depende do seed.
-- - Helpers no schema test_helpers (só existe dentro desta transação): simulam o usuário por claims JWT
--   (role authenticated ou anon), sem chave secreta e sem o papel de serviço.
-- - test_helpers.cases: o SQL de cada operação por tabela e escopo (A = ensaio atribuído, B = não atribuído,
--   own/other = linha própria ou de outra pessoa, '-' = sem escopo).
-- - test_helpers.rules: o resultado esperado por classe de tabela e tipo de usuário.
-- - test_helpers.attempt executa a operação, mede (ok:N linhas | erro:SQLSTATE) e DESFAZ, para uma
--   tentativa não interferir na outra.
-- - Toda tabela nova do schema public sem linha em cases faz a suíte falhar (cobertura obrigatória).

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Helpers reutilizáveis
-- ---------------------------------------------------------------------------
create schema test_helpers;

-- Usuários: 1 coordination, 2 field (só A), 3 home_office (só A), 4 sem perfil (atribuído a A),
-- 5 field (A e B; dono das linhas "de outra pessoa").
create function test_helpers.uid(p_n integer) returns uuid
language sql immutable
as $$ select ('a1000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid $$;

-- Ensaios: 1 = A (atribuído), 2 = B (não atribuído aos usuários 2, 3 e 4), 3 = vazio (sem dado de campo).
create function test_helpers.trial(p_t integer) returns uuid
language sql immutable
as $$ select ('10100000-0000-4000-8000-' || lpad(p_t::text, 12, '0'))::uuid $$;

-- Id de fixture: tabela (código 01..99), ensaio (1, 2) e variante
-- (1 = principal, 2 = solta/sem dependentes, 3 = de outra pessoa, 9 = nova, usada nos INSERTs).
create function test_helpers.rid(p_tbl integer, p_t integer, p_v integer) returns uuid
language sql immutable
as $$ select ('a0' || lpad(p_tbl::text, 2, '0') || '0000-0000-4000-8000-' || lpad((p_t * 10 + p_v)::text, 12, '0'))::uuid $$;

create function test_helpers.actor_uid(p_actor text) returns uuid
language sql immutable
as $$
  select test_helpers.uid(case p_actor
    when 'coordination' then 1 when 'field' then 2 when 'home_office' then 3 when 'no_role' then 4 else 9 end)
$$;

-- Simula a sessão do usuário (como o PostgREST faz): role do banco + claims JWT.
create function test_helpers.authenticate_as(p_actor text) returns void
language plpgsql
as $$
begin
  if p_actor = 'anon' then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_helpers.actor_uid(p_actor), 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

-- Executa a operação como o usuário atual e desfaz; devolve ok:<linhas> ou erro:<sqlstate>.
create function test_helpers.attempt(p_sql text) returns text
language plpgsql
as $$
declare
  v_rows bigint;
  v_outcome text;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    v_outcome := 'ok:' || v_rows;
    raise exception 'desfaz a tentativa' using errcode = 'ZT001';
  exception
    when sqlstate 'ZT001' then null;
    when others then v_outcome := 'erro:' || sqlstate;
  end;
  return v_outcome;
end;
$$;

-- Troca {me} pelo usuário da vez e {other} pelo usuário 5.
create function test_helpers.render(p_sql text, p_actor text) returns text
language sql immutable
as $$
  select replace(
    replace(p_sql, '{me}', quote_literal(test_helpers.actor_uid(p_actor)::text)),
    '{other}', quote_literal(test_helpers.uid(5)::text)
  )
$$;

-- Classe de regra de cada tabela (null = tabela sem regra; a suíte falha).
create function test_helpers.class_of(p_tbl text) returns text
language sql immutable
as $$
  select case
    when p_tbl = 'trials' then 'ensaios'
    when p_tbl in ('trial_members', 'factors', 'factor_levels', 'treatments', 'treatment_factor_levels',
                   'plots', 'assessment_variables', 'planned_assessments') then 'estrutura'
    when p_tbl in ('field_records', 'field_record_photos', 'applications', 'occurrences') then 'campo'
    when p_tbl = 'quality_flags' then 'conferencia'
    when p_tbl = 'change_history' then 'historico'
    when p_tbl = 'profiles' then 'perfis'
    when p_tbl in ('notification_preferences', 'push_subscriptions') then 'pessoal'
    when p_tbl = 'calendar_feed_tokens' then 'token'
    when p_tbl = 'notification_log' then 'log'
  end
$$;

-- Tabelas com trial_id que têm alguma linha visível do ensaio para o usuário atual (teste de vazamento).
create function test_helpers.visible_tables(p_trial uuid) returns text[]
language plpgsql
as $$
declare
  r record;
  n bigint;
  v_found text[] := '{}';
begin
  for r in
    select c.relname::text as tbl
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'trial_id' and not a.attisdropped
    where ns.nspname = 'public' and c.relkind in ('r', 'p')
    order by 1
  loop
    execute format('select count(*) from public.%I where trial_id = $1', r.tbl) into n using p_trial;
    if n > 0 then
      v_found := v_found || r.tbl;
    end if;
  end loop;
  return v_found;
end;
$$;

create table test_helpers.cases (
  ord serial primary key,
  tbl text not null,
  op text not null check (op in ('select', 'insert', 'update', 'delete')),
  scope text not null,
  sql text not null,
  unique (tbl, op, scope)
);

create table test_helpers.rules (
  class text not null,
  actor text not null check (actor in ('coordination', 'field', 'home_office', 'no_role', 'anon')),
  op text not null,
  scope text not null,
  outcome text not null,
  primary key (class, actor, op, scope)
);

create function test_helpers.add_case(p_tbl text, p_op text, p_scope text, p_sql text) returns void
language sql
as $$ insert into test_helpers.cases (tbl, op, scope, sql) values (p_tbl, p_op, p_scope, p_sql) $$;

-- Roda a matriz para o usuário da sessão atual.
create function test_helpers.check_matrix(p_actor text) returns setof text
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select c.tbl, c.op, c.scope, c.sql, ru.outcome
    from test_helpers.cases c
    join test_helpers.rules ru
      on ru.class = test_helpers.class_of(c.tbl) and ru.op = c.op and ru.scope = c.scope and ru.actor = p_actor
    order by c.ord
  loop
    return next is(
      test_helpers.attempt(test_helpers.render(r.sql, p_actor)),
      r.outcome,
      format('%s | %s | %s | %s', p_actor, r.tbl, r.op, r.scope)
    );
  end loop;
end;
$$;

grant usage on schema test_helpers to anon, authenticated;
grant select on all tables in schema test_helpers to anon, authenticated;
grant execute on all functions in schema test_helpers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem claims)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
select test_helpers.uid(n), format('usuario%s.010@exemplo.test', n) from generate_series(1, 5) n;
update public.profiles set role = 'coordination' where id = test_helpers.uid(1);
update public.profiles set role = 'field' where id in (test_helpers.uid(2), test_helpers.uid(5));
update public.profiles set role = 'home_office' where id = test_helpers.uid(3);

do $$
declare
  t integer;
  v_trial uuid;
  v_owner uuid;
  v_reviewer uuid;
begin
  for t in 1..2 loop
    v_trial := test_helpers.trial(t);
    -- dono dos registros de campo: field (2) em A, field B (5) em B
    v_owner := test_helpers.uid(case t when 1 then 2 else 5 end);
    v_reviewer := test_helpers.uid(case t when 1 then 3 else 1 end);

    insert into public.trials (id, code) values (v_trial, 'T010-' || t);
    insert into public.factors (id, trial_id, name) values
      (test_helpers.rid(1, t, 1), v_trial, 'Fator'),
      (test_helpers.rid(1, t, 2), v_trial, 'Fator solto');
    insert into public.factor_levels (id, trial_id, factor_id, name) values
      (test_helpers.rid(2, t, 1), v_trial, test_helpers.rid(1, t, 1), 'Nivel'),
      (test_helpers.rid(2, t, 2), v_trial, test_helpers.rid(1, t, 1), 'Nivel solto');
    insert into public.treatments (id, trial_id, number, name) values
      (test_helpers.rid(3, t, 1), v_trial, 1, 'Testemunha'),
      (test_helpers.rid(3, t, 2), v_trial, 2, 'Tratamento solto');
    insert into public.treatment_factor_levels (id, trial_id, treatment_id, factor_level_id) values
      (test_helpers.rid(4, t, 1), v_trial, test_helpers.rid(3, t, 1), test_helpers.rid(2, t, 1)),
      (test_helpers.rid(4, t, 2), v_trial, test_helpers.rid(3, t, 1), test_helpers.rid(2, t, 2));
    insert into public.plots (id, trial_id, number, block, treatment_id) values
      (test_helpers.rid(5, t, 1), v_trial, 1, 1, test_helpers.rid(3, t, 1)),
      (test_helpers.rid(5, t, 2), v_trial, 2, 1, test_helpers.rid(3, t, 1));
    insert into public.assessment_variables (id, trial_id, name) values
      (test_helpers.rid(6, t, 1), v_trial, 'Altura'),
      (test_helpers.rid(6, t, 2), v_trial, 'Variavel solta');
    insert into public.planned_assessments (id, trial_id, variable_id) values
      (test_helpers.rid(7, t, 1), v_trial, test_helpers.rid(6, t, 1)),
      (test_helpers.rid(7, t, 2), v_trial, test_helpers.rid(6, t, 1));

    insert into public.field_records (id, client_id, trial_id, plot_id, planned_assessment_id, value_numeric, created_by)
    values (test_helpers.rid(8, t, 1), gen_random_uuid(), v_trial, test_helpers.rid(5, t, 1), test_helpers.rid(7, t, 1), 10, v_owner);
    insert into public.field_record_photos (id, client_id, trial_id, field_record_id, storage_path, created_by)
    values (test_helpers.rid(9, t, 1), gen_random_uuid(), v_trial, test_helpers.rid(8, t, 1),
            v_trial || '/' || test_helpers.rid(8, t, 1) || '/foto.jpg', v_owner);
    insert into public.applications (id, client_id, trial_id, applied_at, created_by)
    values (test_helpers.rid(10, t, 1), gen_random_uuid(), v_trial, now(), v_owner);
    insert into public.occurrences (id, client_id, trial_id, plot_id, occurred_at, description, created_by)
    values (test_helpers.rid(11, t, 1), gen_random_uuid(), v_trial, test_helpers.rid(5, t, 1), now(), 'Granizo', v_owner);
    insert into public.quality_flags (id, trial_id, field_record_id, created_by)
    values (test_helpers.rid(12, t, 1), v_trial, test_helpers.rid(8, t, 1), v_reviewer);
  end loop;

  -- Registros de campo de outra pessoa (field B) no ensaio A.
  v_trial := test_helpers.trial(1);
  v_owner := test_helpers.uid(5);
  insert into public.field_records (id, client_id, trial_id, plot_id, planned_assessment_id, value_numeric, created_by)
  values (test_helpers.rid(8, 1, 3), gen_random_uuid(), v_trial, test_helpers.rid(5, 1, 1), test_helpers.rid(7, 1, 1), 20, v_owner);
  insert into public.field_record_photos (id, client_id, trial_id, field_record_id, storage_path, created_by)
  values (test_helpers.rid(9, 1, 3), gen_random_uuid(), v_trial, test_helpers.rid(8, 1, 3),
          v_trial || '/' || test_helpers.rid(8, 1, 3) || '/foto.jpg', v_owner);
  insert into public.applications (id, client_id, trial_id, applied_at, created_by)
  values (test_helpers.rid(10, 1, 3), gen_random_uuid(), v_trial, now(), v_owner);
  insert into public.occurrences (id, client_id, trial_id, occurred_at, description, created_by)
  values (test_helpers.rid(11, 1, 3), gen_random_uuid(), v_trial, now(), 'Acamamento', v_owner);

  -- Ensaio vazio (sem dado de campo), atribuído aos usuários 2, 3 e 4: testa exclusão de ensaio.
  insert into public.trials (id, code) values (test_helpers.trial(3), 'T010-3');

  insert into public.trial_members (id, trial_id, user_id) values
    (test_helpers.rid(13, 1, 1), test_helpers.trial(1), test_helpers.uid(2)),
    (test_helpers.rid(13, 1, 2), test_helpers.trial(1), test_helpers.uid(3)),
    (test_helpers.rid(13, 1, 4), test_helpers.trial(1), test_helpers.uid(4)),
    (test_helpers.rid(13, 1, 5), test_helpers.trial(1), test_helpers.uid(5)),
    (test_helpers.rid(13, 2, 1), test_helpers.trial(2), test_helpers.uid(5)),
    (test_helpers.rid(13, 3, 2), test_helpers.trial(3), test_helpers.uid(2)),
    (test_helpers.rid(13, 3, 3), test_helpers.trial(3), test_helpers.uid(3)),
    (test_helpers.rid(13, 3, 4), test_helpers.trial(3), test_helpers.uid(4));

  -- Dados pessoais de avisos: uma linha de cada tabela para cada usuário (1 a 5).
  for t in 1..5 loop
    insert into public.notification_preferences (id, user_id, push_enabled)
    values (test_helpers.rid(14, 0, t), test_helpers.uid(t), true);
    insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth_secret)
    values (test_helpers.rid(15, 0, t), test_helpers.uid(t), 'https://push.exemplo.test/' || t, 'chave-' || t, 'segredo-' || t);
    insert into public.calendar_feed_tokens (id, user_id, token_hash, label)
    values (test_helpers.rid(16, 0, t), test_helpers.uid(t),
            encode(sha256(convert_to('token-ficticio-010-' || t, 'UTF8')), 'hex'), 'Agenda ' || t);
    insert into public.notification_log (id, user_id, trial_id, channel, kind, status, dedupe_key)
    values (test_helpers.rid(17, 0, t), test_helpers.uid(t),
            case t when 2 then test_helpers.trial(1) when 3 then test_helpers.trial(1) when 5 then test_helpers.trial(2) end,
            'push', 'assessment_due', 'sent', 'teste-010-' || t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Casos: SQL de cada operação (tabela x operação x escopo)
-- ---------------------------------------------------------------------------
do $$
declare
  t integer;
  sc text;
  v_trial uuid;
  i integer;
  proto text[] := array['factors', 'factor_levels', 'treatments', 'treatment_factor_levels',
                        'plots', 'assessment_variables', 'planned_assessments', 'trial_members'];
  proto_code integer[] := array[1, 2, 3, 4, 5, 6, 7, 13];
  campo text[] := array['field_records', 'field_record_photos', 'applications', 'occurrences', 'quality_flags'];
  campo_code integer[] := array[8, 9, 10, 11, 12];
  campo_set text[] := array[
    'notes = ''editado''',
    'taken_at = now()',
    'notes = ''editado''',
    'description = ''editada''',
    'comment = ''conferido'''
  ];
  reason constant text := ', change_reason = ''teste da matriz''';
begin
  for t in 1..2 loop
    sc := case t when 1 then 'A' else 'B' end;
    v_trial := test_helpers.trial(t);

    -- trials
    perform test_helpers.add_case('trials', 'select', sc, format('select 1 from public.trials where id = %L', v_trial));
    perform test_helpers.add_case('trials', 'update', sc, format('update public.trials set updated_at = now() where id = %L', v_trial));
    perform test_helpers.add_case('trials', 'delete', sc, format('delete from public.trials where id = %L', v_trial));

    -- estrutura do protocolo e trial_members: leitura/alteração da linha principal, exclusão da solta
    for i in 1..array_length(proto, 1) loop
      perform test_helpers.add_case(proto[i], 'select', sc,
        format('select 1 from public.%I where id = %L', proto[i], test_helpers.rid(proto_code[i], t, 1)));
      perform test_helpers.add_case(proto[i], 'update', sc,
        format('update public.%I set updated_at = now() where id = %L', proto[i], test_helpers.rid(proto_code[i], t, 1)));
      perform test_helpers.add_case(proto[i], 'delete', sc,
        format('delete from public.%I where id = %L', proto[i],
               test_helpers.rid(proto_code[i], t, case when proto[i] = 'trial_members' then 1 else 2 end)));
    end loop;

    perform test_helpers.add_case('factors', 'insert', sc, format(
      'insert into public.factors (id, trial_id, name) values (%L, %L, ''Novo'')',
      test_helpers.rid(1, t, 9), v_trial));
    perform test_helpers.add_case('factor_levels', 'insert', sc, format(
      'insert into public.factor_levels (id, trial_id, factor_id, name) values (%L, %L, %L, ''Novo'')',
      test_helpers.rid(2, t, 9), v_trial, test_helpers.rid(1, t, 1)));
    perform test_helpers.add_case('treatments', 'insert', sc, format(
      'insert into public.treatments (id, trial_id, number, name) values (%L, %L, 9, ''Novo'')',
      test_helpers.rid(3, t, 9), v_trial));
    perform test_helpers.add_case('treatment_factor_levels', 'insert', sc, format(
      'insert into public.treatment_factor_levels (id, trial_id, treatment_id, factor_level_id) values (%L, %L, %L, %L)',
      test_helpers.rid(4, t, 9), v_trial, test_helpers.rid(3, t, 2), test_helpers.rid(2, t, 1)));
    perform test_helpers.add_case('plots', 'insert', sc, format(
      'insert into public.plots (id, trial_id, number, block, treatment_id) values (%L, %L, 9, 1, %L)',
      test_helpers.rid(5, t, 9), v_trial, test_helpers.rid(3, t, 1)));
    perform test_helpers.add_case('assessment_variables', 'insert', sc, format(
      'insert into public.assessment_variables (id, trial_id, name) values (%L, %L, ''Nova'')',
      test_helpers.rid(6, t, 9), v_trial));
    perform test_helpers.add_case('planned_assessments', 'insert', sc, format(
      'insert into public.planned_assessments (id, trial_id, variable_id) values (%L, %L, %L)',
      test_helpers.rid(7, t, 9), v_trial, test_helpers.rid(6, t, 1)));
    perform test_helpers.add_case('trial_members', 'insert', sc, format(
      'insert into public.trial_members (id, trial_id, user_id) values (%L, %L, %L)',
      test_helpers.rid(13, t, 9), v_trial, test_helpers.uid(case t when 1 then 1 else 2 end)));

    -- dados de campo e conferência
    for i in 1..array_length(campo, 1) loop
      perform test_helpers.add_case(campo[i], 'select', sc,
        format('select 1 from public.%I where id = %L', campo[i], test_helpers.rid(campo_code[i], t, 1)));
      perform test_helpers.add_case(campo[i], 'update', sc,
        format('update public.%I set %s%s where id = %L', campo[i], campo_set[i], reason, test_helpers.rid(campo_code[i], t, 1)));
      perform test_helpers.add_case(campo[i], 'delete', sc,
        format('delete from public.%I where id = %L', campo[i], test_helpers.rid(campo_code[i], t, 1)));
      -- registro de outra pessoa (field B) no ensaio A
      if t = 1 and campo[i] <> 'quality_flags' then
        perform test_helpers.add_case(campo[i], 'update', 'A_outro',
          format('update public.%I set %s%s where id = %L', campo[i], campo_set[i], reason, test_helpers.rid(campo_code[i], 1, 3)));
      end if;
    end loop;

    perform test_helpers.add_case('field_records', 'insert', sc, format(
      'insert into public.field_records (id, client_id, trial_id, plot_id, planned_assessment_id, value_numeric) '
      'values (%L, gen_random_uuid(), %L, %L, %L, 5)',
      test_helpers.rid(8, t, 9), v_trial, test_helpers.rid(5, t, 1), test_helpers.rid(7, t, 1)));
    perform test_helpers.add_case('field_record_photos', 'insert', sc, format(
      'insert into public.field_record_photos (id, client_id, trial_id, field_record_id, storage_path) '
      'values (%L, gen_random_uuid(), %L, %L, %L)',
      test_helpers.rid(9, t, 9), v_trial, test_helpers.rid(8, t, 1),
      v_trial || '/' || test_helpers.rid(8, t, 1) || '/nova.jpg'));
    perform test_helpers.add_case('applications', 'insert', sc, format(
      'insert into public.applications (id, client_id, trial_id, applied_at) values (%L, gen_random_uuid(), %L, now())',
      test_helpers.rid(10, t, 9), v_trial));
    perform test_helpers.add_case('occurrences', 'insert', sc, format(
      'insert into public.occurrences (id, client_id, trial_id, occurred_at, description) '
      'values (%L, gen_random_uuid(), %L, now(), ''Nova'')',
      test_helpers.rid(11, t, 9), v_trial));
    perform test_helpers.add_case('quality_flags', 'insert', sc, format(
      'insert into public.quality_flags (id, trial_id, field_record_id) values (%L, %L, %L)',
      test_helpers.rid(12, t, 9), v_trial, test_helpers.rid(8, t, 1)));

    -- histórico: a inclusão do registro principal gerou uma linha INSERT
    perform test_helpers.add_case('change_history', 'select', sc, format(
      'select 1 from public.change_history where table_name = ''field_records'' and record_id = %L and operation = ''INSERT''',
      test_helpers.rid(8, t, 1)));
    perform test_helpers.add_case('change_history', 'insert', sc, format(
      'insert into public.change_history (table_name, record_id, trial_id, operation) values (''field_records'', %L, %L, ''INSERT'')',
      test_helpers.rid(8, t, 1), v_trial));
    perform test_helpers.add_case('change_history', 'update', sc, format(
      'update public.change_history set reason = ''forjado'' where record_id = %L', test_helpers.rid(8, t, 1)));
    perform test_helpers.add_case('change_history', 'delete', sc, format(
      'delete from public.change_history where record_id = %L', test_helpers.rid(8, t, 1)));
  end loop;

  perform test_helpers.add_case('trials', 'insert', '-', 'insert into public.trials (code) values (''T010-NOVO'')');
  perform test_helpers.add_case('trials', 'delete', 'vazio', format('delete from public.trials where id = %L', test_helpers.trial(3)));

  -- profiles
  perform test_helpers.add_case('profiles', 'select', 'own', 'select 1 from public.profiles where id = {me}');
  perform test_helpers.add_case('profiles', 'select', 'other', 'select 1 from public.profiles where id = {other}');
  perform test_helpers.add_case('profiles', 'insert', '-', 'insert into public.profiles (id, email) values (gen_random_uuid(), ''novo@exemplo.test'')');
  perform test_helpers.add_case('profiles', 'update', 'own', 'update public.profiles set full_name = ''Nome editado'' where id = {me}');
  perform test_helpers.add_case('profiles', 'update', 'other', 'update public.profiles set full_name = ''Nome editado'' where id = {other}');
  perform test_helpers.add_case('profiles', 'delete', '-', 'delete from public.profiles where id = {me}');

  -- notification_preferences
  perform test_helpers.add_case('notification_preferences', 'select', 'own', 'select 1 from public.notification_preferences where user_id = {me}');
  perform test_helpers.add_case('notification_preferences', 'select', 'other', 'select 1 from public.notification_preferences where user_id = {other}');
  perform test_helpers.add_case('notification_preferences', 'insert', 'own',
    'insert into public.notification_preferences (user_id, push_enabled) values ({me}, false) '
    'on conflict (user_id) do update set push_enabled = excluded.push_enabled');
  perform test_helpers.add_case('notification_preferences', 'insert', 'other',
    'insert into public.notification_preferences (user_id, push_enabled) values ({other}, false)');
  perform test_helpers.add_case('notification_preferences', 'update', 'own', 'update public.notification_preferences set lead_time_hours = 12 where user_id = {me}');
  perform test_helpers.add_case('notification_preferences', 'update', 'other', 'update public.notification_preferences set lead_time_hours = 12 where user_id = {other}');
  perform test_helpers.add_case('notification_preferences', 'delete', 'own', 'delete from public.notification_preferences where user_id = {me}');
  perform test_helpers.add_case('notification_preferences', 'delete', 'other', 'delete from public.notification_preferences where user_id = {other}');

  -- push_subscriptions
  perform test_helpers.add_case('push_subscriptions', 'select', 'own', 'select 1 from public.push_subscriptions where user_id = {me}');
  perform test_helpers.add_case('push_subscriptions', 'select', 'other', 'select 1 from public.push_subscriptions where user_id = {other}');
  perform test_helpers.add_case('push_subscriptions', 'insert', 'own',
    'insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret) values ({me}, ''https://push.exemplo.test/nova'', ''k'', ''s'')');
  perform test_helpers.add_case('push_subscriptions', 'insert', 'other',
    'insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret) values ({other}, ''https://push.exemplo.test/nova'', ''k'', ''s'')');
  perform test_helpers.add_case('push_subscriptions', 'update', 'own', 'update public.push_subscriptions set p256dh = ''nova'' where user_id = {me}');
  perform test_helpers.add_case('push_subscriptions', 'update', 'other', 'update public.push_subscriptions set p256dh = ''nova'' where user_id = {other}');
  perform test_helpers.add_case('push_subscriptions', 'delete', 'own', 'delete from public.push_subscriptions where user_id = {me}');
  perform test_helpers.add_case('push_subscriptions', 'delete', 'other', 'delete from public.push_subscriptions where user_id = {other}');

  -- calendar_feed_tokens
  perform test_helpers.add_case('calendar_feed_tokens', 'select', 'own', 'select id from public.calendar_feed_tokens where user_id = {me}');
  perform test_helpers.add_case('calendar_feed_tokens', 'select', 'other', 'select id from public.calendar_feed_tokens where user_id = {other}');
  perform test_helpers.add_case('calendar_feed_tokens', 'select', 'hash', 'select token_hash from public.calendar_feed_tokens where user_id = {me}');
  perform test_helpers.add_case('calendar_feed_tokens', 'insert', 'own',
    'insert into public.calendar_feed_tokens (label, token_hash) values (''nova'', encode(sha256(convert_to(gen_random_uuid()::text, ''UTF8'')), ''hex''))');
  perform test_helpers.add_case('calendar_feed_tokens', 'insert', 'other',
    'insert into public.calendar_feed_tokens (user_id, label, token_hash) values ({other}, ''x'', repeat(''c'', 64))');
  perform test_helpers.add_case('calendar_feed_tokens', 'update', 'own', 'update public.calendar_feed_tokens set revoked_at = now() where user_id = {me}');
  perform test_helpers.add_case('calendar_feed_tokens', 'update', 'other', 'update public.calendar_feed_tokens set revoked_at = now() where user_id = {other}');
  perform test_helpers.add_case('calendar_feed_tokens', 'delete', 'own', 'delete from public.calendar_feed_tokens where user_id = {me}');
  perform test_helpers.add_case('calendar_feed_tokens', 'delete', 'other', 'delete from public.calendar_feed_tokens where user_id = {other}');

  -- notification_log
  perform test_helpers.add_case('notification_log', 'select', 'own', 'select 1 from public.notification_log where user_id = {me}');
  perform test_helpers.add_case('notification_log', 'select', 'other', 'select 1 from public.notification_log where user_id = {other}');
  perform test_helpers.add_case('notification_log', 'insert', 'own',
    'insert into public.notification_log (user_id, channel, kind, status, dedupe_key) values ({me}, ''push'', ''x'', ''sent'', ''forjado-'' || gen_random_uuid())');
  perform test_helpers.add_case('notification_log', 'update', 'own', 'update public.notification_log set status = ''failed'' where user_id = {me}');
  perform test_helpers.add_case('notification_log', 'delete', 'own', 'delete from public.notification_log where user_id = {me}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Regras: resultado esperado (igual a docs/seguranca/matriz-acesso.md)
-- ok:1 = permitido; ok:0 = filtrado pela RLS (nenhuma linha); erro:42501 = negado; erro:23503 = FK
-- ---------------------------------------------------------------------------
insert into test_helpers.rules (class, actor, op, scope, outcome)
select v.class, unnest(v.actors), v.op, v.scope, v.outcome
from (values
  -- ensaios (trials)
  ('ensaios', '{coordination}'::text[], 'select', 'A', 'ok:1'),
  ('ensaios', '{coordination}', 'select', 'B', 'ok:1'),
  ('ensaios', '{field,home_office}', 'select', 'A', 'ok:1'),
  ('ensaios', '{no_role}', 'select', 'A', 'ok:0'),
  ('ensaios', '{field,home_office,no_role}', 'select', 'B', 'ok:0'),
  ('ensaios', '{coordination}', 'insert', '-', 'ok:1'),
  ('ensaios', '{field,home_office,no_role}', 'insert', '-', 'erro:42501'),
  ('ensaios', '{coordination}', 'update', 'A', 'ok:1'),
  ('ensaios', '{coordination}', 'update', 'B', 'ok:1'),
  ('ensaios', '{field,home_office,no_role}', 'update', 'A', 'ok:0'),
  ('ensaios', '{field,home_office,no_role}', 'update', 'B', 'ok:0'),
  -- ensaio com dado de campo não é excluído (FK sem cascade); ensaio vazio, sim
  ('ensaios', '{coordination}', 'delete', 'A', 'erro:23503'),
  ('ensaios', '{coordination}', 'delete', 'B', 'erro:23503'),
  ('ensaios', '{coordination}', 'delete', 'vazio', 'ok:1'),
  ('ensaios', '{field,home_office,no_role}', 'delete', 'A', 'ok:0'),
  ('ensaios', '{field,home_office,no_role}', 'delete', 'B', 'ok:0'),
  ('ensaios', '{field,home_office,no_role}', 'delete', 'vazio', 'ok:0'),

  -- estrutura do protocolo e trial_members: leitura por membros com perfil; escrita só coordination
  ('estrutura', '{coordination}', 'select', 'A', 'ok:1'),
  ('estrutura', '{coordination}', 'select', 'B', 'ok:1'),
  ('estrutura', '{field,home_office}', 'select', 'A', 'ok:1'),
  ('estrutura', '{no_role}', 'select', 'A', 'ok:0'),
  ('estrutura', '{field,home_office,no_role}', 'select', 'B', 'ok:0'),
  ('estrutura', '{coordination}', 'insert', 'A', 'ok:1'),
  ('estrutura', '{coordination}', 'insert', 'B', 'ok:1'),
  ('estrutura', '{field,home_office,no_role}', 'insert', 'A', 'erro:42501'),
  ('estrutura', '{field,home_office,no_role}', 'insert', 'B', 'erro:42501'),
  ('estrutura', '{coordination}', 'update', 'A', 'ok:1'),
  ('estrutura', '{coordination}', 'update', 'B', 'ok:1'),
  ('estrutura', '{field,home_office,no_role}', 'update', 'A', 'ok:0'),
  ('estrutura', '{field,home_office,no_role}', 'update', 'B', 'ok:0'),
  ('estrutura', '{coordination}', 'delete', 'A', 'ok:1'),
  ('estrutura', '{coordination}', 'delete', 'B', 'ok:1'),
  ('estrutura', '{field,home_office,no_role}', 'delete', 'A', 'ok:0'),
  ('estrutura', '{field,home_office,no_role}', 'delete', 'B', 'ok:0'),

  -- dados de campo: field atribuído grava e corrige os próprios; home_office não edita; ninguém exclui
  ('campo', '{coordination}', 'select', 'A', 'ok:1'),
  ('campo', '{coordination}', 'select', 'B', 'ok:1'),
  ('campo', '{field,home_office}', 'select', 'A', 'ok:1'),
  ('campo', '{no_role}', 'select', 'A', 'ok:0'),
  ('campo', '{field,home_office,no_role}', 'select', 'B', 'ok:0'),
  ('campo', '{coordination}', 'insert', 'A', 'ok:1'),
  ('campo', '{coordination}', 'insert', 'B', 'ok:1'),
  ('campo', '{field}', 'insert', 'A', 'ok:1'),
  ('campo', '{field}', 'insert', 'B', 'erro:42501'),
  ('campo', '{home_office,no_role}', 'insert', 'A', 'erro:42501'),
  ('campo', '{home_office,no_role}', 'insert', 'B', 'erro:42501'),
  ('campo', '{coordination}', 'update', 'A', 'ok:1'),
  ('campo', '{coordination}', 'update', 'B', 'ok:1'),
  ('campo', '{coordination}', 'update', 'A_outro', 'ok:1'),
  ('campo', '{field}', 'update', 'A', 'ok:1'),
  ('campo', '{field}', 'update', 'B', 'ok:0'),
  ('campo', '{field}', 'update', 'A_outro', 'ok:0'),
  ('campo', '{home_office,no_role}', 'update', 'A', 'ok:0'),
  ('campo', '{home_office,no_role}', 'update', 'B', 'ok:0'),
  ('campo', '{home_office,no_role}', 'update', 'A_outro', 'ok:0'),
  ('campo', '{coordination,field,home_office,no_role}', 'delete', 'A', 'erro:42501'),
  ('campo', '{coordination,field,home_office,no_role}', 'delete', 'B', 'erro:42501'),

  -- conferência (quality_flags): home_office atribuído e coordination; field só lê; ninguém exclui
  ('conferencia', '{coordination}', 'select', 'A', 'ok:1'),
  ('conferencia', '{coordination}', 'select', 'B', 'ok:1'),
  ('conferencia', '{field,home_office}', 'select', 'A', 'ok:1'),
  ('conferencia', '{no_role}', 'select', 'A', 'ok:0'),
  ('conferencia', '{field,home_office,no_role}', 'select', 'B', 'ok:0'),
  ('conferencia', '{coordination}', 'insert', 'A', 'ok:1'),
  ('conferencia', '{coordination}', 'insert', 'B', 'ok:1'),
  ('conferencia', '{home_office}', 'insert', 'A', 'ok:1'),
  ('conferencia', '{home_office}', 'insert', 'B', 'erro:42501'),
  ('conferencia', '{field,no_role}', 'insert', 'A', 'erro:42501'),
  ('conferencia', '{field,no_role}', 'insert', 'B', 'erro:42501'),
  ('conferencia', '{coordination}', 'update', 'A', 'ok:1'),
  ('conferencia', '{coordination}', 'update', 'B', 'ok:1'),
  ('conferencia', '{home_office}', 'update', 'A', 'ok:1'),
  ('conferencia', '{home_office}', 'update', 'B', 'ok:0'),
  ('conferencia', '{field,no_role}', 'update', 'A', 'ok:0'),
  ('conferencia', '{field,no_role}', 'update', 'B', 'ok:0'),
  ('conferencia', '{coordination,field,home_office,no_role}', 'delete', 'A', 'erro:42501'),
  ('conferencia', '{coordination,field,home_office,no_role}', 'delete', 'B', 'erro:42501'),

  -- histórico: só leitura (membros do ensaio e coordination); inclusão só por gatilho
  ('historico', '{coordination}', 'select', 'A', 'ok:1'),
  ('historico', '{coordination}', 'select', 'B', 'ok:1'),
  ('historico', '{field,home_office}', 'select', 'A', 'ok:1'),
  ('historico', '{no_role}', 'select', 'A', 'ok:0'),
  ('historico', '{field,home_office,no_role}', 'select', 'B', 'ok:0'),
  ('historico', '{coordination,field,home_office,no_role}', 'insert', 'A', 'erro:42501'),
  ('historico', '{coordination,field,home_office,no_role}', 'insert', 'B', 'erro:42501'),
  ('historico', '{coordination,field,home_office,no_role}', 'update', 'A', 'erro:42501'),
  ('historico', '{coordination,field,home_office,no_role}', 'update', 'B', 'erro:42501'),
  ('historico', '{coordination,field,home_office,no_role}', 'delete', 'A', 'erro:42501'),
  ('historico', '{coordination,field,home_office,no_role}', 'delete', 'B', 'erro:42501'),

  -- perfis
  ('perfis', '{coordination,field,home_office,no_role}', 'select', 'own', 'ok:1'),
  ('perfis', '{coordination}', 'select', 'other', 'ok:1'),
  ('perfis', '{field,home_office,no_role}', 'select', 'other', 'ok:0'),
  ('perfis', '{coordination,field,home_office,no_role}', 'insert', '-', 'erro:42501'),
  ('perfis', '{coordination,field,home_office,no_role}', 'update', 'own', 'ok:1'),
  ('perfis', '{coordination}', 'update', 'other', 'ok:1'),
  ('perfis', '{field,home_office,no_role}', 'update', 'other', 'ok:0'),
  ('perfis', '{coordination,field,home_office,no_role}', 'delete', '-', 'erro:42501'),

  -- preferências e inscrições push: só o dono; gravar exige perfil
  ('pessoal', '{coordination,field,home_office,no_role}', 'select', 'own', 'ok:1'),
  ('pessoal', '{coordination,field,home_office,no_role}', 'select', 'other', 'ok:0'),
  ('pessoal', '{coordination,field,home_office}', 'insert', 'own', 'ok:1'),
  ('pessoal', '{no_role}', 'insert', 'own', 'erro:42501'),
  ('pessoal', '{coordination,field,home_office,no_role}', 'insert', 'other', 'erro:42501'),
  ('pessoal', '{coordination,field,home_office}', 'update', 'own', 'ok:1'),
  ('pessoal', '{no_role}', 'update', 'own', 'ok:0'),
  ('pessoal', '{coordination,field,home_office,no_role}', 'update', 'other', 'ok:0'),
  ('pessoal', '{coordination,field,home_office}', 'delete', 'own', 'ok:1'),
  ('pessoal', '{no_role}', 'delete', 'own', 'ok:0'),
  ('pessoal', '{coordination,field,home_office,no_role}', 'delete', 'other', 'ok:0'),

  -- tokens do feed: dono cria e revoga; coordination vê metadados e revoga; hash ilegível; sem exclusão
  ('token', '{coordination,field,home_office,no_role}', 'select', 'own', 'ok:1'),
  ('token', '{coordination}', 'select', 'other', 'ok:1'),
  ('token', '{field,home_office,no_role}', 'select', 'other', 'ok:0'),
  ('token', '{coordination,field,home_office,no_role}', 'select', 'hash', 'erro:42501'),
  ('token', '{coordination,field,home_office}', 'insert', 'own', 'ok:1'),
  ('token', '{no_role}', 'insert', 'own', 'erro:42501'),
  ('token', '{coordination,field,home_office,no_role}', 'insert', 'other', 'erro:42501'),
  ('token', '{coordination,field,home_office}', 'update', 'own', 'ok:1'),
  ('token', '{no_role}', 'update', 'own', 'ok:0'),
  ('token', '{coordination}', 'update', 'other', 'ok:1'),
  ('token', '{field,home_office,no_role}', 'update', 'other', 'ok:0'),
  ('token', '{coordination,field,home_office,no_role}', 'delete', 'own', 'erro:42501'),
  ('token', '{coordination,field,home_office,no_role}', 'delete', 'other', 'erro:42501'),

  -- log de avisos: leitura pelo dono e coordination; escrita só pelo serviço
  ('log', '{coordination,field,home_office,no_role}', 'select', 'own', 'ok:1'),
  ('log', '{coordination}', 'select', 'other', 'ok:1'),
  ('log', '{field,home_office,no_role}', 'select', 'other', 'ok:0'),
  ('log', '{coordination,field,home_office,no_role}', 'insert', 'own', 'erro:42501'),
  ('log', '{coordination,field,home_office,no_role}', 'update', 'own', 'erro:42501'),
  ('log', '{coordination,field,home_office,no_role}', 'delete', 'own', 'erro:42501')
) as v(class, actors, op, scope, outcome);

-- anon: nenhum privilégio em nenhuma tabela.
insert into test_helpers.rules (class, actor, op, scope, outcome)
select distinct test_helpers.class_of(c.tbl), 'anon', c.op, c.scope, 'erro:42501'
from test_helpers.cases c
where test_helpers.class_of(c.tbl) is not null;

-- ---------------------------------------------------------------------------
-- Regras transversais (estrutura)
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'toda tabela do schema public tem RLS ligada'
);

select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public'
       and (btrim(coalesce(qual, '')) in ('true', '(true)') or btrim(coalesce(with_check, '')) in ('true', '(true)')) $$,
  'nenhuma política do schema public usa using (true) ou with check (true)'
);

select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public' and roles <> '{authenticated}'::name[] $$,
  'toda política do schema public vale só para authenticated (nenhuma para anon ou public)'
);

select is_empty(
  $$ select n.nspname || '.' || p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%') $$,
  'toda função security definer do schema public tem search_path fixo'
);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon não executa nenhuma função security definer'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate') $$,
  'anon não tem privilégio em nenhuma tabela do schema public'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
     except
     select tbl from test_helpers.cases $$,
  'toda tabela do schema public está na matriz (tabela nova sem caso faz a suíte falhar)'
);

select is_empty(
  $$ select distinct c.tbl from test_helpers.cases c where test_helpers.class_of(c.tbl) is null $$,
  'toda tabela da matriz tem classe de regra'
);

select is_empty(
  $$ select c.tbl || ' ' || c.op || ' ' || c.scope || ' ' || a.actor
     from test_helpers.cases c
     cross join (values ('coordination'), ('field'), ('home_office'), ('no_role'), ('anon')) a(actor)
     left join test_helpers.rules r
       on r.class = test_helpers.class_of(c.tbl) and r.op = c.op and r.scope = c.scope and r.actor = a.actor
     where r.outcome is null $$,
  'toda célula da matriz tem resultado esperado para os cinco tipos de usuário'
);

select is_empty(
  $$ select r.class || ' ' || r.actor || ' ' || r.op || ' ' || r.scope from test_helpers.rules r
     where not exists (
       select 1 from test_helpers.cases c
       where test_helpers.class_of(c.tbl) = r.class and c.op = r.op and c.scope = r.scope) $$,
  'nenhuma regra órfã (sem caso correspondente)'
);

select ok(
  (select bool_and(n = 4) from (
    select count(distinct op) as n from test_helpers.cases group by tbl) x),
  'toda tabela tem caso de SELECT, INSERT, UPDATE e DELETE'
);

-- Linhas do ensaio B visíveis para postgres (referência para coordination).
create table test_helpers.trial_b_tables as
select unnest(test_helpers.visible_tables(test_helpers.trial(2))) as tbl;
grant select on test_helpers.trial_b_tables to authenticated;

-- ---------------------------------------------------------------------------
-- Matriz por tipo de usuário
-- ---------------------------------------------------------------------------
select test_helpers.authenticate_as('coordination');
select * from test_helpers.check_matrix('coordination');
select is(
  test_helpers.visible_tables(test_helpers.trial(2)),
  (select array_agg(tbl order by tbl) from test_helpers.trial_b_tables),
  'coordination vê as linhas do ensaio B em todas as tabelas com trial_id'
);
reset role;

select test_helpers.authenticate_as('field');
select * from test_helpers.check_matrix('field');
select is(test_helpers.visible_tables(test_helpers.trial(2)), '{}'::text[], 'field: nenhuma linha do ensaio não atribuído vaza em nenhuma tabela');
reset role;

select test_helpers.authenticate_as('home_office');
select * from test_helpers.check_matrix('home_office');
select is(test_helpers.visible_tables(test_helpers.trial(2)), '{}'::text[], 'home_office: nenhuma linha do ensaio não atribuído vaza em nenhuma tabela');
reset role;

select test_helpers.authenticate_as('no_role');
select * from test_helpers.check_matrix('no_role');
select is(test_helpers.visible_tables(test_helpers.trial(1)), '{}'::text[], 'sem perfil: nada do ensaio em que está atribuído é visível');
select is(test_helpers.visible_tables(test_helpers.trial(2)), '{}'::text[], 'sem perfil: nada do ensaio não atribuído é visível');
reset role;

select test_helpers.authenticate_as('anon');
select * from test_helpers.check_matrix('anon');
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Tentativas desfeitas: as fixtures continuam intactas
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.trials where id::text like '10100000-%'), 3, 'nenhuma tentativa da matriz deixou efeito em trials');
select is((select count(*)::int from public.field_records where id::text like 'a008%'), 3, 'nenhuma tentativa da matriz deixou efeito em field_records');
select is(
  (select count(*)::int from public.calendar_feed_tokens where id::text like 'a016%' and revoked_at is null),
  5, 'nenhuma tentativa da matriz revogou token'
);

select * from finish();
rollback;
