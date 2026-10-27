-- Tarefa 013: Before User Created Hook (domínio de e-mail).
-- NÃO EXECUTADO: requer Docker/Supabase local. Rodar com: npx supabase test db
-- Domínio FICTÍCIO (empresa-ficticia.test); tudo é desfeito no rollback.

begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- Evento simulado no formato do Supabase Auth (payload do before_user_created).
create function pg_temp.ev(p_email text, p_provider text default 'email', p_user_metadata jsonb default '{}'::jsonb)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'metadata', jsonb_build_object('name', 'before-user-created', 'uuid', gen_random_uuid()),
    'user', jsonb_build_object(
      'id', gen_random_uuid(),
      'email', p_email,
      'app_metadata', jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)),
      'user_metadata', p_user_metadata
    )
  );
$$;

create function pg_temp.aceita(p_event jsonb) returns boolean language sql as $$
  select public.hook_before_user_created(p_event) = '{}'::jsonb;
$$;

create function pg_temp.recusa(p_event jsonb) returns boolean language sql as $$
  select (public.hook_before_user_created(p_event) -> 'error' ->> 'http_code') = '403';
$$;

-- ---------------------------------------------------------------------------
-- Estrutura e privilégios
-- ---------------------------------------------------------------------------
select has_function('public', 'hook_before_user_created', array['jsonb'], 'hook existe');
select is(
  (select prosecdef from pg_proc where oid = 'public.hook_before_user_created(jsonb)'::regprocedure),
  true, 'hook é security definer');
select ok(
  (select exists (select 1 from unnest(proconfig) c where c like 'search_path=%')
     from pg_proc where oid = 'public.hook_before_user_created(jsonb)'::regprocedure),
  'hook tem search_path fixo');

select ok(has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'supabase_auth_admin executa o hook');
select ok(not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute'), 'anon não executa o hook');
select ok(not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute'),
  'authenticated não executa o hook');
select ok(not has_function_privilege('service_role', 'public.hook_before_user_created(jsonb)', 'execute'),
  'service_role não executa o hook');

select ok(has_function_privilege('service_role', 'public.set_auth_email_domain(text)', 'execute'),
  'service_role grava o domínio');
select ok(not has_function_privilege('authenticated', 'public.set_auth_email_domain(text)', 'execute'),
  'authenticated não grava o domínio');
select ok(not has_function_privilege('anon', 'public.set_auth_email_domain(text)', 'execute'), 'anon não grava o domínio');

select ok(not has_schema_privilege('authenticated', 'app_private', 'usage'), 'authenticated não usa o schema app_private');
select ok(not has_schema_privilege('anon', 'app_private', 'usage'), 'anon não usa o schema app_private');
select ok(not has_table_privilege('authenticated', 'app_private.auth_settings', 'select'),
  'authenticated não lê a configuração');
select ok((select relrowsecurity from pg_class where oid = 'app_private.auth_settings'::regclass),
  'RLS ligada em app_private.auth_settings');
select is((select count(*)::int from app_private.auth_settings), 1, 'configuração tem uma única linha');
select throws_ok($$ insert into app_private.auth_settings (id) values (false) $$, '23514', null,
  'não há segunda linha de configuração');

-- ---------------------------------------------------------------------------
-- Domínio não configurado: padrão seguro
-- ---------------------------------------------------------------------------
update app_private.auth_settings set allowed_email_domain = null, local_test_mode = false, require_verified_email_claim = false;

select ok(pg_temp.recusa(pg_temp.ev('ana@empresa-ficticia.test')), 'sem domínio configurado: recusa');
select ok(pg_temp.recusa(pg_temp.ev('coordenacao@exemplo.test')), 'sem domínio e sem modo local: recusa exemplo.test');

update app_private.auth_settings set local_test_mode = true;
select ok(pg_temp.aceita(pg_temp.ev('novo@exemplo.test')), 'modo local: aceita usuário fictício exemplo.test');
select ok(pg_temp.recusa(pg_temp.ev('novo@sub.exemplo.test')), 'modo local: recusa subdomínio de exemplo.test');
select ok(pg_temp.recusa(pg_temp.ev('ana@empresa-ficticia.test')), 'modo local sem domínio: recusa os demais');
update app_private.auth_settings set local_test_mode = false;

-- ---------------------------------------------------------------------------
-- Domínio configurado (normalizado pela função do serviço)
-- ---------------------------------------------------------------------------
select is(public.set_auth_email_domain('  @Empresa-Ficticia.TEST '), 'empresa-ficticia.test', 'domínio é normalizado');
select is((select allowed_email_domain from app_private.auth_settings), 'empresa-ficticia.test', 'domínio gravado');
select throws_ok($$ select public.set_auth_email_domain('empresa..test') $$, '23514', null, 'domínio malformado é recusado');
select throws_ok($$ select public.set_auth_email_domain('empresa ficticia.test') $$, '23514', null, 'domínio com espaço é recusado');

-- aceitos
select ok(pg_temp.aceita(pg_temp.ev('ana@empresa-ficticia.test')), 'aceita e-mail do domínio');
select ok(pg_temp.aceita(pg_temp.ev('Ana.Silva@EMPRESA-FICTICIA.TEST')), 'aceita sem diferença de maiúsculas');
select ok(pg_temp.aceita(pg_temp.ev('  ana@empresa-ficticia.test  ')), 'aceita com espaços nas pontas');
select ok(pg_temp.aceita(pg_temp.ev('ana+campo@empresa-ficticia.test')), 'aceita subendereço (+) no mesmo domínio');

-- recusados
select ok(pg_temp.recusa(pg_temp.ev('ana@outro-dominio.test')), 'recusa outro domínio');
select ok(pg_temp.recusa(pg_temp.ev('ana@sub.empresa-ficticia.test')), 'recusa subdomínio');
select ok(pg_temp.recusa(pg_temp.ev('ana@empresa-ficticia.test.evil.test')), 'recusa sufixo após o domínio');
select ok(pg_temp.recusa(pg_temp.ev('ana@xempresa-ficticia.test')), 'recusa domínio com prefixo parecido');
select ok(pg_temp.recusa(pg_temp.ev('ana@outro.test@empresa-ficticia.test')), 'recusa duplo @ (domínio certo no fim)');
select ok(pg_temp.recusa(pg_temp.ev('ana@empresa-ficticia.test@outro.test')), 'recusa duplo @ (domínio certo no meio)');
select ok(pg_temp.recusa(pg_temp.ev('ana silva@empresa-ficticia.test')), 'recusa espaço no meio');
select ok(pg_temp.recusa(pg_temp.ev('@empresa-ficticia.test')), 'recusa parte local vazia');
select ok(pg_temp.recusa(pg_temp.ev('ana@')), 'recusa domínio vazio');
select ok(pg_temp.recusa(pg_temp.ev('')), 'recusa e-mail vazio');
select ok(pg_temp.recusa(pg_temp.ev(null)), 'recusa sem e-mail (ex.: telefone)');
select ok(pg_temp.recusa('{}'::jsonb), 'recusa evento sem usuário');
select ok(pg_temp.recusa(pg_temp.ev('novo@exemplo.test')), 'com modo local desligado, exemplo.test é recusado');

-- mensagem genérica, em português, sem revelar o domínio
select is(
  public.hook_before_user_created(pg_temp.ev('ana@outro-dominio.test')) -> 'error' ->> 'message',
  'Cadastro não permitido. Entre com a conta Microsoft da empresa ou procure a coordenação.',
  'mensagem de recusa em pt-BR');
select ok(
  position('empresa-ficticia' in public.hook_before_user_created(pg_temp.ev('ana@outro-dominio.test'))::text) = 0,
  'mensagem não revela o domínio permitido');

-- ---------------------------------------------------------------------------
-- Claim xms_edov (provedor azure)
-- ---------------------------------------------------------------------------
select ok(pg_temp.aceita(pg_temp.ev('ana@empresa-ficticia.test', 'azure', '{"custom_claims":{"xms_edov":true}}')),
  'azure com xms_edov verdadeiro: aceita');
select ok(pg_temp.aceita(pg_temp.ev('ana@empresa-ficticia.test', 'azure', '{"xms_edov":"1"}')),
  'azure com xms_edov "1" no user_metadata: aceita');
select ok(pg_temp.recusa(pg_temp.ev('ana@empresa-ficticia.test', 'azure', '{"custom_claims":{"xms_edov":false}}')),
  'azure com xms_edov falso: recusa');
select ok(pg_temp.recusa(pg_temp.ev('ana@empresa-ficticia.test', 'azure', '{"xms_edov":"0"}')),
  'azure com xms_edov "0": recusa');
select ok(pg_temp.aceita(pg_temp.ev('ana@empresa-ficticia.test', 'azure', '{}')),
  'azure sem a claim e sem exigência: aceita');
select ok(pg_temp.recusa(pg_temp.ev('ana@outro-dominio.test', 'azure', '{"custom_claims":{"xms_edov":true}}')),
  'claim verdadeira não libera outro domínio');

update app_private.auth_settings set require_verified_email_claim = true;
select ok(pg_temp.recusa(pg_temp.ev('ana@empresa-ficticia.test', 'azure', '{}')),
  'com exigência ligada: azure sem a claim é recusado');
select ok(pg_temp.aceita(pg_temp.ev('ana@empresa-ficticia.test', 'azure', '{"custom_claims":{"xms_edov":"true"}}')),
  'com exigência ligada: azure com a claim é aceito');
update app_private.auth_settings set require_verified_email_claim = false;

-- ---------------------------------------------------------------------------
-- Funções de comparação
-- ---------------------------------------------------------------------------
select is(app_private.normalize_email_domain(null), null, 'normalize: nulo');
select is(app_private.normalize_email_domain('   '), null, 'normalize: vazio vira nulo');
select ok(not app_private.email_matches_domain('ana@empresa-ficticia.test', null), 'sem domínio não há correspondência');

-- ---------------------------------------------------------------------------
-- Ninguém além do Auth chama o hook
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.hook_before_user_created('{}'::jsonb) $$, '42501', null,
  'authenticated não consegue chamar o hook');
select throws_ok($$ select public.set_auth_email_domain('outro.test') $$, '42501', null,
  'authenticated não consegue trocar o domínio');
reset role;

set local role anon;
select throws_ok($$ select public.hook_before_user_created('{}'::jsonb) $$, '42501', null, 'anon não consegue chamar o hook');
reset role;

select * from finish();
rollback;
