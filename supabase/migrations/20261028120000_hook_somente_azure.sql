-- Correção pós-revisão (achado M1, docs/seguranca/003-019.md): o hook passa a recusar cadastro por
-- provedor diferente de azure (Microsoft), salvo com configuração EXPLÍCITA do ambiente local.
-- NÃO EXECUTADO: requer Docker/Supabase local. Validar com: npx supabase db reset && npx supabase test db
--
-- Decisões:
-- - Nova coluna app_private.auth_settings.allow_non_azure_providers, padrão false (só azure).
--   Só o seed local liga (usuários fictícios entram por e-mail e senha). supabase db push não roda
--   o seed, então teste e produção ficam no padrão.
-- - A conferência de provedor vem ANTES de qualquer outra: nem o modo local (exemplo.test) nem o
--   domínio certo liberam cadastro por e-mail/senha, telefone, anônimo ou outro OAuth sem a flag.
-- - Provedor ausente conta como "não azure" (recusa).
-- - O restante da regra (domínio, claim xms_edov) não muda.

alter table app_private.auth_settings
  add column allow_non_azure_providers boolean not null default false;

comment on column app_private.auth_settings.allow_non_azure_providers is
  'Aceita cadastro por provedor diferente de azure. Só o seed LOCAL liga; teste e produção ficam false.';

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

  -- Só Microsoft (azure), salvo configuração explícita do ambiente local.
  if v_provider <> 'azure' and not coalesce(v_cfg.allow_non_azure_providers, false) then
    return v_recusa;
  end if;

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
  'Before User Created Hook: só provedor azure (salvo modo local explícito) e e-mail do domínio permitido.';

-- create or replace mantém os privilégios; reaplicados por clareza.
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
