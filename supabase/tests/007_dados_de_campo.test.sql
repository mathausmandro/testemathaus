-- Tarefa 007: matriz de acesso dos dados de campo, anulação, idempotência, DELETE bloqueado e bucket de fotos.
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Fixtures próprias (prefixo 07...), desfeitas no rollback. Perfis simulados por claims JWT, sem chave secreta.
-- O motivo de edição vai por app.change_reason (lido pelo gatilho de histórico da 008; ignorado antes dela).
--
-- Estratégia para Storage: as políticas de storage.objects são testadas inserindo/lendo linhas em
-- storage.objects com o papel authenticated (a mesma checagem que a API de Storage faz). Limite de tamanho e
-- tipo de arquivo são aplicados pela API de Storage, não pelo SQL: aqui só se confere a configuração do bucket;
-- o upload real (tipo/tamanho/URL pública negada) fica para o teste e2e com Supabase local.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select set_config('app.change_reason', 'teste automatizado 007', true);

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

grant execute on all functions in schema test_helpers to authenticated, anon;

create temporary table field_tables (name text) on commit drop;
insert into field_tables values
  ('field_records'), ('field_record_photos'), ('applications'), ('occurrences'), ('quality_flags');
grant select on field_tables to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem claims)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('07000000-0000-4000-8000-000000000001', 'coord.007@exemplo.test'),
  ('07000000-0000-4000-8000-000000000002', 'campo.007@exemplo.test'),
  ('07000000-0000-4000-8000-000000000003', 'campo2.007@exemplo.test'),
  ('07000000-0000-4000-8000-000000000004', 'escritorio.007@exemplo.test'),
  ('07000000-0000-4000-8000-000000000005', 'semperfil.007@exemplo.test');
update public.profiles set role = 'coordination' where id = '07000000-0000-4000-8000-000000000001';
update public.profiles set role = 'field' where id in ('07000000-0000-4000-8000-000000000002', '07000000-0000-4000-8000-000000000003');
update public.profiles set role = 'home_office' where id = '07000000-0000-4000-8000-000000000004';

insert into public.trials (id, code) values
  ('07100000-0000-4000-8000-00000000000a', 'T007-A'),
  ('07100000-0000-4000-8000-00000000000b', 'T007-B');
insert into public.trial_members (trial_id, user_id)
select '07100000-0000-4000-8000-00000000000a', u
from unnest(array[
  '07000000-0000-4000-8000-000000000002', '07000000-0000-4000-8000-000000000003',
  '07000000-0000-4000-8000-000000000004', '07000000-0000-4000-8000-000000000005']::uuid[]) u;

insert into public.plots (id, trial_id, number) values
  ('07400000-0000-4000-8000-00000000000a', '07100000-0000-4000-8000-00000000000a', 1),
  ('07400000-0000-4000-8000-00000000000b', '07100000-0000-4000-8000-00000000000b', 1);
insert into public.assessment_variables (id, trial_id, name) values
  ('07500000-0000-4000-8000-00000000000a', '07100000-0000-4000-8000-00000000000a', 'V'),
  ('07500000-0000-4000-8000-00000000000b', '07100000-0000-4000-8000-00000000000b', 'V');
insert into public.planned_assessments (id, trial_id, variable_id) values
  ('07600000-0000-4000-8000-00000000000a', '07100000-0000-4000-8000-00000000000a', '07500000-0000-4000-8000-00000000000a'),
  ('07600000-0000-4000-8000-00000000000b', '07100000-0000-4000-8000-00000000000b', '07500000-0000-4000-8000-00000000000b');

insert into public.field_records (id, client_id, trial_id, plot_id, planned_assessment_id, value_numeric, created_by) values
  ('07700000-0000-4000-8000-0000000000a1', '07900000-0000-4000-8000-0000000000a1', '07100000-0000-4000-8000-00000000000a',
   '07400000-0000-4000-8000-00000000000a', '07600000-0000-4000-8000-00000000000a', 10, '07000000-0000-4000-8000-000000000002'),
  ('07700000-0000-4000-8000-0000000000a2', '07900000-0000-4000-8000-0000000000a2', '07100000-0000-4000-8000-00000000000a',
   '07400000-0000-4000-8000-00000000000a', '07600000-0000-4000-8000-00000000000a', 20, '07000000-0000-4000-8000-000000000003'),
  ('07700000-0000-4000-8000-0000000000b1', '07900000-0000-4000-8000-0000000000b1', '07100000-0000-4000-8000-00000000000b',
   '07400000-0000-4000-8000-00000000000b', '07600000-0000-4000-8000-00000000000b', 30, '07000000-0000-4000-8000-000000000001');
insert into public.field_record_photos (client_id, trial_id, field_record_id, storage_path, created_by) values
  ('07910000-0000-4000-8000-0000000000a1', '07100000-0000-4000-8000-00000000000a', '07700000-0000-4000-8000-0000000000a1',
   '07100000-0000-4000-8000-00000000000a/07700000-0000-4000-8000-0000000000a1/1.jpg', '07000000-0000-4000-8000-000000000002'),
  ('07910000-0000-4000-8000-0000000000b1', '07100000-0000-4000-8000-00000000000b', '07700000-0000-4000-8000-0000000000b1',
   '07100000-0000-4000-8000-00000000000b/07700000-0000-4000-8000-0000000000b1/1.jpg', '07000000-0000-4000-8000-000000000001');
insert into public.applications (client_id, trial_id, applied_at, created_by) values
  ('07920000-0000-4000-8000-0000000000a1', '07100000-0000-4000-8000-00000000000a', now(), '07000000-0000-4000-8000-000000000002'),
  ('07920000-0000-4000-8000-0000000000b1', '07100000-0000-4000-8000-00000000000b', now(), '07000000-0000-4000-8000-000000000001');
insert into public.occurrences (client_id, trial_id, occurred_at, description, created_by) values
  ('07930000-0000-4000-8000-0000000000a1', '07100000-0000-4000-8000-00000000000a', now(), 'Granizo', '07000000-0000-4000-8000-000000000002'),
  ('07930000-0000-4000-8000-0000000000b1', '07100000-0000-4000-8000-00000000000b', now(), 'Granizo', '07000000-0000-4000-8000-000000000001');
insert into public.quality_flags (id, trial_id, field_record_id, created_by) values
  ('07740000-0000-4000-8000-0000000000a1', '07100000-0000-4000-8000-00000000000a', '07700000-0000-4000-8000-0000000000a1', '07000000-0000-4000-8000-000000000004'),
  ('07740000-0000-4000-8000-0000000000b1', '07100000-0000-4000-8000-00000000000b', '07700000-0000-4000-8000-0000000000b1', '07000000-0000-4000-8000-000000000001');
insert into storage.objects (bucket_id, name) values
  ('field-photos', '07100000-0000-4000-8000-00000000000a/07700000-0000-4000-8000-0000000000a1/1.jpg'),
  ('field-photos', '07100000-0000-4000-8000-00000000000b/07700000-0000-4000-8000-0000000000b1/1.jpg');

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select ok(c.relrowsecurity, format('RLS ligada em %s', t.name))
from field_tables t join pg_class c on c.oid = ('public.' || t.name)::regclass;

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('field_records','field_record_photos','applications','occurrences','quality_flags')
       and cmd in ('DELETE', 'ALL') $$,
  'nenhuma política de DELETE em tabelas de campo'
);
select ok(not has_table_privilege('authenticated', 'public.field_records', 'delete'), 'authenticated sem privilégio de DELETE em field_records');
select ok(not has_table_privilege('service_role', 'public.field_records', 'delete'), 'service_role sem privilégio de DELETE em field_records');

select is((select public from storage.buckets where id = 'field-photos'), false, 'bucket field-photos é privado');
select is((select file_size_limit from storage.buckets where id = 'field-photos'), 10485760::bigint, 'bucket limita o tamanho a 10 MiB');
select ok(
  (select bool_and(m like 'image/%') from storage.buckets b, unnest(b.allowed_mime_types) m where b.id = 'field-photos'),
  'bucket aceita apenas imagens'
);
select ok(
  not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
              and policyname like 'field_photos%' and cmd in ('UPDATE', 'DELETE', 'ALL')),
  'fotos sem política de UPDATE/DELETE no Storage'
);

-- Mesmo o dono do banco não exclui nem trunca registros de campo.
select throws_ok($$ delete from public.field_records where trial_id = '07100000-0000-4000-8000-00000000000a' $$, '42501', null, 'postgres não exclui field_records (gatilho)');
select throws_ok($$ truncate public.field_records cascade $$, '42501', null, 'TRUNCATE de field_records bloqueado');
select throws_ok($$ delete from public.trials where id = '07100000-0000-4000-8000-00000000000a' $$, '23503', null, 'ensaio com registro de campo não é excluído');

-- ---------------------------------------------------------------------------
-- field
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"07000000-0000-4000-8000-000000000002","role":"authenticated"}';

select ok(test_helpers.count_rows(t.name, '07100000-0000-4000-8000-00000000000a') > 0, format('field lê %s do ensaio atribuído', t.name))
from field_tables t;
select is(test_helpers.count_rows(t.name, '07100000-0000-4000-8000-00000000000b'), 0, format('field não lê %s de outro ensaio', t.name))
from field_tables t;

select lives_ok(
  $$ insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, value_numeric, created_by)
     values ('07900000-0000-4000-8000-0000000000a3', '07100000-0000-4000-8000-00000000000a', '07400000-0000-4000-8000-00000000000a',
             '07600000-0000-4000-8000-00000000000a', 11, '07000000-0000-4000-8000-000000000001') $$,
  'field grava registro no ensaio atribuído'
);
select is(
  (select created_by from public.field_records where client_id = '07900000-0000-4000-8000-0000000000a3'),
  '07000000-0000-4000-8000-000000000002'::uuid,
  'autor gravado é auth.uid(), não o enviado pelo cliente'
);
select throws_ok(
  $$ insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, value_numeric, created_by)
     values ('07900000-0000-4000-8000-0000000000a3', '07100000-0000-4000-8000-00000000000a', '07400000-0000-4000-8000-00000000000a',
             '07600000-0000-4000-8000-00000000000a', 11, '07000000-0000-4000-8000-000000000002') $$,
  '23505', null, 'reenviar o mesmo client_id não duplica (erro de unicidade)'
);
select is_empty(
  $$ insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, value_numeric, created_by)
     values ('07900000-0000-4000-8000-0000000000a3', '07100000-0000-4000-8000-00000000000a', '07400000-0000-4000-8000-00000000000a',
             '07600000-0000-4000-8000-00000000000a', 11, '07000000-0000-4000-8000-000000000002')
     on conflict (client_id) do nothing returning id $$,
  'ON CONFLICT (client_id) DO NOTHING não insere de novo'
);
select is((select count(*)::int from public.field_records where client_id = '07900000-0000-4000-8000-0000000000a3'), 1, 'continua uma linha por client_id');

select throws_ok(
  $$ insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, created_by)
     values ('07900000-0000-4000-8000-0000000000b9', '07100000-0000-4000-8000-00000000000b', '07400000-0000-4000-8000-00000000000b',
             '07600000-0000-4000-8000-00000000000b', '07000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'field não grava em ensaio não atribuído'
);
select throws_ok(
  $$ insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, status, voided_reason, created_by)
     values ('07900000-0000-4000-8000-0000000000a8', '07100000-0000-4000-8000-00000000000a', '07400000-0000-4000-8000-00000000000a',
             '07600000-0000-4000-8000-00000000000a', 'voided', 'x', '07000000-0000-4000-8000-000000000002') $$,
  '23514', null, 'registro não nasce anulado'
);
select lives_ok(
  $$ insert into public.applications (client_id, trial_id, applied_at, created_by)
     values ('07920000-0000-4000-8000-0000000000a2', '07100000-0000-4000-8000-00000000000a', now(), '07000000-0000-4000-8000-000000000002') $$,
  'field grava aplicação no ensaio atribuído'
);
select lives_ok(
  $$ insert into public.occurrences (client_id, trial_id, plot_id, occurred_at, description, created_by)
     values ('07930000-0000-4000-8000-0000000000a2', '07100000-0000-4000-8000-00000000000a', '07400000-0000-4000-8000-00000000000a', now(), 'Acamamento', '07000000-0000-4000-8000-000000000002') $$,
  'field grava ocorrência no ensaio atribuído'
);
select lives_ok(
  $$ insert into public.field_record_photos (client_id, trial_id, field_record_id, storage_path, created_by)
     values ('07910000-0000-4000-8000-0000000000a2', '07100000-0000-4000-8000-00000000000a', '07700000-0000-4000-8000-0000000000a1',
             '07100000-0000-4000-8000-00000000000a/07700000-0000-4000-8000-0000000000a1/2.jpg', '07000000-0000-4000-8000-000000000002') $$,
  'field grava foto no ensaio atribuído'
);
select throws_ok(
  $$ insert into public.applications (client_id, trial_id, applied_at, created_by)
     values ('07920000-0000-4000-8000-0000000000b2', '07100000-0000-4000-8000-00000000000b', now(), '07000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'field não grava aplicação em ensaio não atribuído'
);
select throws_ok(
  $$ insert into public.occurrences (client_id, trial_id, occurred_at, description, created_by)
     values ('07930000-0000-4000-8000-0000000000b2', '07100000-0000-4000-8000-00000000000b', now(), 'X', '07000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'field não grava ocorrência em ensaio não atribuído'
);
select throws_ok(
  $$ insert into public.quality_flags (trial_id, field_record_id, created_by)
     values ('07100000-0000-4000-8000-00000000000a', '07700000-0000-4000-8000-0000000000a1', '07000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'field não cria conferência'
);
with u as (update public.quality_flags set status = 'checked' where trial_id = '07100000-0000-4000-8000-00000000000a' returning 1)
select is(count(*)::int, 0, 'field não trata conferência') from u;

-- Correção dos próprios registros, nunca dos alheios.
with u as (update public.field_records set value_numeric = 12 where id = '07700000-0000-4000-8000-0000000000a1' returning 1)
select is(count(*)::int, 1, 'field corrige o próprio registro') from u;
with u as (update public.field_records set value_numeric = 99 where id = '07700000-0000-4000-8000-0000000000a2' returning 1)
select is(count(*)::int, 0, 'field não altera registro de outro field') from u;
with u as (update public.applications set notes = 'x' where trial_id = '07100000-0000-4000-8000-00000000000a' and created_by <> '07000000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 0, 'field não altera aplicação alheia') from u;
select throws_ok(
  $$ update public.field_records set trial_id = '07100000-0000-4000-8000-00000000000b' where id = '07700000-0000-4000-8000-0000000000a1' $$,
  '42501', null, 'field não move registro para outro ensaio'
);
select throws_ok(
  $$ update public.field_records set client_id = gen_random_uuid() where id = '07700000-0000-4000-8000-0000000000a1' $$,
  '42501', null, 'client_id é imutável'
);

-- Anulação.
select throws_ok(
  $$ update public.field_records set status = 'voided' where id = '07700000-0000-4000-8000-0000000000a1' $$,
  '23514', null, 'anular sem motivo é rejeitado'
);
select throws_ok(
  $$ update public.field_records set status = 'voided', voided_reason = '   ' where id = '07700000-0000-4000-8000-0000000000a1' $$,
  '23514', null, 'anular com motivo em branco é rejeitado'
);
with u as (update public.field_records set status = 'voided', voided_reason = 'Parcela errada' where id = '07700000-0000-4000-8000-0000000000a1' returning voided_by, voided_at)
select ok(bool_and(voided_by = '07000000-0000-4000-8000-000000000002' and voided_at is not null), 'field anula o próprio registro com motivo; quem e quando gravados') from u;
select throws_ok(
  $$ update public.field_records set value_numeric = 1 where id = '07700000-0000-4000-8000-0000000000a1' $$,
  '55000', null, 'registro anulado não pode mais ser alterado'
);
select throws_ok(
  $$ update public.field_records set status = 'valid', voided_reason = null where id = '07700000-0000-4000-8000-0000000000a1' $$,
  '55000', null, 'anulação não pode ser desfeita'
);

select throws_ok($$ delete from public.field_records where id = '07700000-0000-4000-8000-0000000000a2' $$, '42501', null, 'field não exclui field_records');
select throws_ok($$ delete from public.applications where trial_id = '07100000-0000-4000-8000-00000000000a' $$, '42501', null, 'field não exclui applications');
select throws_ok($$ delete from public.occurrences where trial_id = '07100000-0000-4000-8000-00000000000a' $$, '42501', null, 'field não exclui occurrences');
select throws_ok($$ delete from public.field_record_photos where trial_id = '07100000-0000-4000-8000-00000000000a' $$, '42501', null, 'field não exclui field_record_photos');

-- Storage
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('field-photos', '07100000-0000-4000-8000-00000000000a/07700000-0000-4000-8000-0000000000a1/3.jpg') $$,
  'field envia foto para o ensaio atribuído'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('field-photos', '07100000-0000-4000-8000-00000000000b/07700000-0000-4000-8000-0000000000b1/3.jpg') $$,
  '42501', null, 'field não envia foto para ensaio não atribuído'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('field-photos', 'sem-ensaio/foto.jpg') $$,
  '42501', null, 'caminho sem ensaio válido é recusado'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'field-photos' and name like '07100000-%'),
  2, 'field lista só as fotos do ensaio atribuído'
);

-- ---------------------------------------------------------------------------
-- home_office: lê; cria e trata conferência; não grava dado de campo
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"07000000-0000-4000-8000-000000000004","role":"authenticated"}';

select ok(test_helpers.count_rows(t.name, '07100000-0000-4000-8000-00000000000a') > 0, format('home_office lê %s do ensaio atribuído', t.name))
from field_tables t;
select is(test_helpers.count_rows(t.name, '07100000-0000-4000-8000-00000000000b'), 0, format('home_office não lê %s de outro ensaio', t.name))
from field_tables t;
select is(test_helpers.touch_rows(t.name, '07100000-0000-4000-8000-00000000000a'), 0, format('home_office não atualiza %s', t.name))
from field_tables t where t.name <> 'quality_flags';

select throws_ok(
  $$ insert into public.field_records (client_id, trial_id, plot_id, planned_assessment_id, created_by)
     values ('07900000-0000-4000-8000-0000000000a4', '07100000-0000-4000-8000-00000000000a', '07400000-0000-4000-8000-00000000000a',
             '07600000-0000-4000-8000-00000000000a', '07000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'home_office não grava field_records'
);
select throws_ok(
  $$ insert into public.applications (client_id, trial_id, applied_at, created_by)
     values ('07920000-0000-4000-8000-0000000000a4', '07100000-0000-4000-8000-00000000000a', now(), '07000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'home_office não grava applications'
);
select throws_ok(
  $$ insert into public.occurrences (client_id, trial_id, occurred_at, description, created_by)
     values ('07930000-0000-4000-8000-0000000000a4', '07100000-0000-4000-8000-00000000000a', now(), 'X', '07000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'home_office não grava occurrences'
);
select throws_ok(
  $$ insert into public.field_record_photos (client_id, trial_id, field_record_id, storage_path, created_by)
     values ('07910000-0000-4000-8000-0000000000a4', '07100000-0000-4000-8000-00000000000a', '07700000-0000-4000-8000-0000000000a2',
             '07100000-0000-4000-8000-00000000000a/07700000-0000-4000-8000-0000000000a2/9.jpg', '07000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'home_office não grava field_record_photos'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('field-photos', '07100000-0000-4000-8000-00000000000a/07700000-0000-4000-8000-0000000000a2/9.jpg') $$,
  '42501', null, 'home_office não envia foto'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'field-photos' and name like '07100000-%'),
  2, 'home_office vê as fotos do ensaio atribuído'
);

select lives_ok(
  $$ insert into public.quality_flags (id, trial_id, field_record_id, status, comment, created_by)
     values ('07740000-0000-4000-8000-0000000000a2', '07100000-0000-4000-8000-00000000000a', '07700000-0000-4000-8000-0000000000a2',
             'correction_requested', 'Valor fora do esperado', '07000000-0000-4000-8000-000000000001') $$,
  'home_office pede correção no ensaio atribuído'
);
select is(
  (select created_by from public.quality_flags where id = '07740000-0000-4000-8000-0000000000a2'),
  '07000000-0000-4000-8000-000000000004'::uuid,
  'autor da conferência é auth.uid()'
);
with u as (update public.quality_flags set status = 'checked' where id = '07740000-0000-4000-8000-0000000000a1' returning handled_by)
select is(max(handled_by), '07000000-0000-4000-8000-000000000004'::uuid, 'home_office marca como conferido e fica como quem tratou') from u;
select throws_ok(
  $$ insert into public.quality_flags (trial_id, created_by) values ('07100000-0000-4000-8000-00000000000b', '07000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'home_office não cria conferência em ensaio não atribuído'
);
select throws_ok($$ delete from public.quality_flags where trial_id = '07100000-0000-4000-8000-00000000000a' $$, '42501', null, 'home_office não exclui conferência');

-- ---------------------------------------------------------------------------
-- coordination: tudo, exceto excluir
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"07000000-0000-4000-8000-000000000001","role":"authenticated"}';

select ok(test_helpers.count_rows(t.name, '07100000-0000-4000-8000-00000000000b') > 0, format('coordination lê %s de qualquer ensaio', t.name))
from field_tables t;
with u as (update public.field_records set value_numeric = 21 where id = '07700000-0000-4000-8000-0000000000a2' returning 1)
select is(count(*)::int, 1, 'coordination corrige registro de outro autor') from u;
with u as (update public.applications set status = 'voided', voided_reason = 'Lançada em duplicidade' where client_id = '07920000-0000-4000-8000-0000000000b1' returning 1)
select is(count(*)::int, 1, 'coordination anula com motivo') from u;
select lives_ok(
  $$ insert into public.occurrences (client_id, trial_id, occurred_at, description, created_by)
     values ('07930000-0000-4000-8000-0000000000b3', '07100000-0000-4000-8000-00000000000b', now(), 'Seca', '07000000-0000-4000-8000-000000000001') $$,
  'coordination grava em qualquer ensaio'
);
select throws_ok($$ delete from public.field_records where id = '07700000-0000-4000-8000-0000000000b1' $$, '42501', null, 'coordination não exclui field_records');
select throws_ok($$ delete from public.applications where trial_id = '07100000-0000-4000-8000-00000000000b' $$, '42501', null, 'coordination não exclui applications');
select throws_ok($$ delete from public.occurrences where trial_id = '07100000-0000-4000-8000-00000000000b' $$, '42501', null, 'coordination não exclui occurrences');
select throws_ok($$ delete from public.field_record_photos where trial_id = '07100000-0000-4000-8000-00000000000b' $$, '42501', null, 'coordination não exclui field_record_photos');
select throws_ok($$ delete from public.quality_flags where trial_id = '07100000-0000-4000-8000-00000000000b' $$, '42501', null, 'coordination não exclui quality_flags');

-- ---------------------------------------------------------------------------
-- Sem perfil (atribuído ao ensaio A) e anon
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"07000000-0000-4000-8000-000000000005","role":"authenticated"}';

select is(test_helpers.count_rows(t.name, '07100000-0000-4000-8000-00000000000a'), 0, format('sem perfil não lê %s', t.name))
from field_tables t;
select is((select count(*)::int from storage.objects where bucket_id = 'field-photos'), 0, 'sem perfil não lista fotos');
select throws_ok(
  $$ insert into public.occurrences (client_id, trial_id, occurred_at, description, created_by)
     values ('07930000-0000-4000-8000-0000000000a5', '07100000-0000-4000-8000-00000000000a', now(), 'X', '07000000-0000-4000-8000-000000000005') $$,
  '42501', null, 'sem perfil não grava'
);

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.field_records $$, '42501', null, 'anon não lê field_records');
select is((select count(*)::int from storage.objects where bucket_id = 'field-photos'), 0, 'anon não lista fotos do bucket');
reset role;

select * from finish();
rollback;
