-- Tarefa 013: Before User Created Hook que recusa e-mail fora do domínio permitido.
-- NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
-- Validar com: npx supabase db reset && npx supabase test db
--
-- Decisões:
-- - O domínio NÃO está nesta migration. Fica em app_private.auth_settings (uma linha), alimentada
--   a partir de ALLOWED_EMAIL_DOMAIN por scripts/set-allowed-email-domain.mjs (chama a função
--   public.set_auth_email_domain, executável só pelo service_role).
-- - Schema app_private fora da API (não está em [api].schemas): anon e authenticated não o enxergam.
--   RLS ligada e sem política: só o dono (postgres) lê; o hook é security definer.
-- - Padrão seguro: sem domínio configurado, todo cadastro novo é recusado.
-- - local_test_mode (ligado só pelo seed local) aceita também o domínio reservado exemplo.test
--   (RFC 6761, não é domínio real), usado pelos usuários fictícios dos testes.
-- - Regra de comparação: e-mail com exatamente um @, sem espaços; o domínio (depois do @, sem
--   diferença de maiúsculas) precisa ser IGUAL ao permitido. Subdomínio (a@sub.dominio),
--   sufixo (a@dominio.evil), prefixo (a@xdominio) e duplo @ são recusados.
-- - Provedor azure: se a claim xms_edov vier e não for verdadeira, recusa. Se não vier, recusa só com
--   require_verified_email_claim = true (ligar depois que a TI configurar a claim opcional).
-- - Mensagem de recusa genérica em pt-BR (não diz qual domínio é aceito nem se o e-mail existe).

create schema if not exists app_private;
revoke all on schema app_private from public;
revoke all on schema app_private from anon, authenticated;

create table app_private.auth_settings (
  id boolean primary key default true check (id),
  allowed_email_domain text
    check (
      allowed_email_domain is null
      or allowed_email_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    ),
  local_test_mode boolean not null default false,
  require_verified_email_claim boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table app_private.auth_settings is
  'Configuração do hook de domínio (uma linha). Domínio vem de ALLOWED_EMAIL_DOMAIN; nunca fixo em migration.';

insert into app_private.auth_settings (id) values (true);

alter table app_private.auth_settings enable row level security;
revoke all on app_private.auth_settings from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funções puras de comparação (testáveis no pgTAP)
-- ---------------------------------------------------------------------------
create or replace function app_private.normalize_email_domain(p_domain text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(ltrim(btrim(coalesce(p_domain, '')), '@')), '');
$$;

create or replace function app_private.email_matches_domain(p_email text, p_domain text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_domain text := app_private.normalize_email_domain(p_domain);
begin
  if v_domain is null or v_email = '' then
    return false;
  end if;
  -- exatamente um @, parte local e domínio não vazios, sem espaços
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
    return false;
  end if;
  return split_part(v_email, '@', 2) = v_domain;
end;
$$;

revoke execute on function app_private.normalize_email_domain(text) from public;
revoke execute on function app_private.email_matches_domain(text, text) from public;

-- ---------------------------------------------------------------------------
-- Hook (registrado em supabase/config.toml: [auth.hook.before_user_created])
-- ---------------------------------------------------------------------------
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg app_private.auth_settings%rowtype;
  v_user jsonb := coalesce(event -> 'user', '{}'::jsonb);
  v_email text := v_user ->> 'email';
  v_provider text := lower(coalesce(v_user -> 'app_metadata' ->> 'provider', ''));
  v_domain text;
  v_edov text;
  v_recusa constant jsonb := jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Cadastro não permitido. Entre com a conta Microsoft da empresa ou procure a coordenação.'
    )
  );
begin
  select * into v_cfg from app_private.auth_settings s where s.id;
  v_domain := app_private.normalize_email_domain(v_cfg.allowed_email_domain);

  -- Usuários fictícios do ambiente local (domínio reservado .test), só com o modo local ligado.
  if coalesce(v_cfg.local_test_mode, false) and app_private.email_matches_domain(v_email, 'exemplo.test') then
    return '{}'::jsonb;
  end if;

  -- Sem domínio configurado: padrão seguro, ninguém se cadastra.
  if v_domain is null or not app_private.email_matches_domain(v_email, v_domain) then
    return v_recusa;
  end if;

  -- E-mail verificado pelo tenant (claim opcional xms_edov do Entra ID). Caminho exato a confirmar
  -- no primeiro login real (docs/tarefas/013); por isso três lugares possíveis.
  if v_provider = 'azure' then
    v_edov := lower(coalesce(
      v_user -> 'user_metadata' -> 'custom_claims' ->> 'xms_edov',
      v_user -> 'user_metadata' ->> 'xms_edov',
      v_user -> 'identities' -> 0 -> 'identity_data' -> 'custom_claims' ->> 'xms_edov'
    ));
    if v_edov is not null and v_edov not in ('true', '1') then
      return v_recusa;
    end if;
    if v_edov is null and coalesce(v_cfg.require_verified_email_claim, false) then
      return v_recusa;
    end if;
  end if;

  return '{}'::jsonb;
end;
$$;
comment on function public.hook_before_user_created(jsonb) is
  'Before User Created Hook: recusa e-mail fora de app_private.auth_settings.allowed_email_domain.';

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Alimentação da configuração (só serviço): scripts/set-allowed-email-domain.mjs
-- ---------------------------------------------------------------------------
create or replace function public.set_auth_email_domain(p_domain text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_domain text := app_private.normalize_email_domain(p_domain);
begin
  update app_private.auth_settings s
     set allowed_email_domain = v_domain, updated_at = now()
   where s.id;
  return v_domain;
end;
$$;
comment on function public.set_auth_email_domain(text) is
  'Grava o domínio permitido (normalizado). Só service_role; nulo/vazio desliga todos os cadastros.';

revoke execute on function public.set_auth_email_domain(text) from public, anon, authenticated;
grant execute on function public.set_auth_email_domain(text) to service_role;
