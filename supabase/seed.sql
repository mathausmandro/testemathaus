-- Dados iniciais do ambiente local (executado por `supabase db reset`, como postgres, após as migrations).
-- NÃO EXECUTADO: requer Docker/Supabase local.
-- Somente dados FICTÍCIOS. Nunca inclua dado pessoal real, domínio real da empresa ou senha real.
-- Tarefa 012: os usuários de teste têm a senha FICTÍCIA "senha-teste-local", usada só pelo login local
-- de desenvolvimento (AUTH_LOCAL_PASSWORD_LOGIN=true com Supabase local). O seed nunca roda em teste nem
-- produção (supabase db push não aplica seed). O login real do sistema é Microsoft.

-- ---------------------------------------------------------------------------
-- Tarefa 013: modo local do hook de domínio (aceita o domínio reservado exemplo.test em cadastros
-- novos). O domínio real NÃO entra aqui: use npm run auth:domain com ALLOWED_EMAIL_DOMAIN.
-- ---------------------------------------------------------------------------
update app_private.auth_settings set local_test_mode = true;

-- ---------------------------------------------------------------------------
-- Tarefa 005: um usuário por perfil e um sem perfil; dois ensaios
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'coordenacao@exemplo.test', extensions.crypt('senha-teste-local', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Coordenação Fictícia"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'campo@exemplo.test', extensions.crypt('senha-teste-local', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Campo Fictício"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'escritorio@exemplo.test', extensions.crypt('senha-teste-local', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Home Office Fictício"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'aguardando@exemplo.test', extensions.crypt('senha-teste-local', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aguardando Liberação"}',
   '', '', '', '', now(), now());

-- Identidade do provedor email (o GoTrue usa para o login por senha).
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id::text like '10000000-%';

-- O gatilho on_auth_user_created já criou os perfis com role nula; aqui a "coordenação" libera três.
update public.profiles set role = 'coordination' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'field' where id = '10000000-0000-4000-8000-000000000002';
update public.profiles set role = 'home_office' where id = '10000000-0000-4000-8000-000000000003';

insert into public.trials (id, code, contractor, crop, location, design, planned_start_date, planned_end_date, technical_lead, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'ENS-TESTE-01', 'Contratante Fictícia', 'Soja', 'Área experimental 1', 'dbc',
   '2026-11-01', '2027-03-31', 'Responsável Fictício', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'ENS-TESTE-02', 'Contratante Fictícia', 'Milho', 'Área experimental 2', 'dic',
   '2026-12-01', '2027-04-30', 'Responsável Fictício', '10000000-0000-4000-8000-000000000001');

-- field e home_office atribuídos só ao ENS-TESTE-01.
insert into public.trial_members (trial_id, user_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003');

-- ---------------------------------------------------------------------------
-- Tarefa 006: protocolo fictício do ENS-TESTE-01 (DBC, 2 tratamentos x 2 blocos = 4 parcelas)
-- A distribuição dos tratamentos abaixo é só ilustrativa; a casualização real vem na Fase 2.
-- ---------------------------------------------------------------------------
insert into public.treatments (id, trial_id, number, name, product, active_ingredient, dose, dose_unit, formulation, timing) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Testemunha', null, null, null, null, null, null),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 2, 'Produto Fictício A', 'Produto Fictício A', 'Ingrediente Fictício', 1.5, 'L/ha', 'SC', 'Pré-emergência');

insert into public.plots (id, trial_id, number, block, treatment_id, grid_row, grid_column) values
  ('31000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 101, 1, '30000000-0000-4000-8000-000000000002', 1, 1),
  ('31000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000001', 102, 1, '30000000-0000-4000-8000-000000000001', 1, 2),
  ('31000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000001', 201, 2, '30000000-0000-4000-8000-000000000001', 2, 1),
  ('31000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000001', 202, 2, '30000000-0000-4000-8000-000000000002', 2, 2);

insert into public.assessment_variables (id, trial_id, name, unit, method, scale, min_value, max_value) values
  ('32000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Variável fictícia', 'cm', 'Método fictício', null, 0, 300);

insert into public.planned_assessments (id, trial_id, variable_id, days_after, reference_event, planned_date, responsible_id) values
  ('33000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001',
   14, 'planting', '2026-11-15', '10000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Tarefa 007: dados de campo fictícios no ENS-TESTE-01 (autor: usuário field do seed)
-- ---------------------------------------------------------------------------
insert into public.field_records (id, client_id, trial_id, plot_id, planned_assessment_id, value_numeric, recorded_at, notes, created_by) values
  ('40000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   '31000000-0000-4000-8000-000000000101', '33000000-0000-4000-8000-000000000001', 42, '2026-11-15 13:00:00+00', 'Registro fictício',
   '10000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
   '31000000-0000-4000-8000-000000000102', '33000000-0000-4000-8000-000000000001', 38, '2026-11-15 13:05:00+00', null,
   '10000000-0000-4000-8000-000000000002');

insert into public.applications (client_id, trial_id, applied_at, equipment, spray_volume, spray_volume_unit, temperature_c, relative_humidity_pct, wind_speed_kmh, operator_name, created_by) values
  ('42000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-11-02 11:00:00+00',
   'Pulverizador costal fictício', 200, 'L/ha', 25, 70, 5, 'Operador Fictício', '10000000-0000-4000-8000-000000000002');

insert into public.occurrences (client_id, trial_id, plot_id, occurred_at, description, created_by) values
  ('43000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000201',
   '2026-11-10 18:00:00+00', 'Ocorrência fictícia', '10000000-0000-4000-8000-000000000002');

insert into public.quality_flags (trial_id, field_record_id, status, comment, created_by) values
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'correction_requested',
   'Conferir valor (fictício)', '10000000-0000-4000-8000-000000000003');
