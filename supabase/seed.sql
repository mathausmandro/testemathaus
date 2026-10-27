-- Dados iniciais do ambiente local (executado por `supabase db reset`, como postgres, após as migrations).
-- NÃO EXECUTADO: requer Docker/Supabase local.
-- Somente dados FICTÍCIOS. Nunca inclua dado pessoal real, domínio real da empresa ou senha.
-- Os usuários não têm senha: o login do sistema é Microsoft (tarefa 012); localmente, use link
-- mágico pelo Mailpit se precisar entrar com um deles.

-- ---------------------------------------------------------------------------
-- Tarefa 005: um usuário por perfil e um sem perfil; dois ensaios
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'coordenacao@exemplo.test', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Coordenação Fictícia"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'campo@exemplo.test', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Campo Fictício"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'escritorio@exemplo.test', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Home Office Fictício"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'aguardando@exemplo.test', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aguardando Liberação"}',
   '', '', '', '', now(), now());

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
