-- Tarefa 009: preferências de aviso, log de avisos, inscrições de push e tokens do feed iCal.
-- NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
-- Validar com: npx supabase db reset && npx supabase test db
--
-- Só estrutura e RLS. Fora do escopo (Fase 4): pg_cron, Edge Function, envio de push/e-mail e o feed iCal.
-- Nenhum segredo nesta migration; URL e chaves da Edge Function irão para o Vault na Fase 4.
--
-- Decisões:
-- - Cada pessoa lê as próprias linhas; gravar (incluir, alterar, excluir) exige perfil atribuído
--   (current_app_role() não nulo). Usuário sem perfil está bloqueado pela coordenação e não grava nada.
-- - notification_log: legível pelo dono e pela coordenação; sem política nem privilégio de escrita para
--   clientes. Quem grava é o serviço (service_role, Fase 4). Sem e-mail, endpoint ou texto da mensagem.
-- - calendar_feed_tokens: só o hash SHA-256 (hex) do token; o token em claro é gerado no servidor
--   (Fase 4: 32 bytes aleatórios, base64url), mostrado uma vez e nunca enviado ao banco.
--   A coluna token_hash não é legível por clientes (privilégio por coluna): nem o dono nem a coordenação
--   a leem. A Edge Function do feed consulta por hash com service_role.
-- - Revogação: revoked_at (não volta a nulo). O dono revoga os próprios tokens; a coordenação revoga
--   qualquer token, mas não altera outros campos de token alheio. Sem DELETE: o token revogado fica para auditoria.
--   Rotação = revogar e criar outro.
-- - Preferências: canais e antecedência nulos = padrão do sistema (valores pendentes com o Mathaus).

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- nulo = usar o padrão do sistema (pendente: canais ativados por padrão)
  push_enabled boolean,
  email_enabled boolean,
  -- antecedência do aviso em horas; nulo = padrão do sistema (pendente)
  lead_time_hours integer check (lead_time_hours between 0 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_user_key unique (user_id)
);
comment on table public.notification_preferences is 'Preferências de aviso por pessoa; nulo = padrão do sistema.';

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- dados da inscrição Web Push (PushSubscription.toJSON())
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null check (btrim(p256dh) <> '' and char_length(p256dh) <= 256),
  auth_secret text not null check (btrim(auth_secret) <> '' and char_length(auth_secret) <= 256),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint)
);
comment on table public.push_subscriptions is 'Inscrições Web Push do aparelho de cada pessoa; só o dono lê.';

create table public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- SHA-256 do token em hexadecimal; o token em claro nunca é gravado
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  label text check (char_length(label) <= 100),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_feed_tokens_token_hash_key unique (token_hash),
  constraint calendar_feed_tokens_revoked_check check (revoked_by is null or revoked_at is not null)
);
comment on table public.calendar_feed_tokens is 'Tokens do feed iCal: só o hash; revogáveis; sem exclusão.';
comment on column public.calendar_feed_tokens.token_hash is 'SHA-256 (hex) do token; ilegível para clientes (privilégio por coluna).';

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  -- destinatário
  user_id uuid not null references public.profiles (id) on delete cascade,
  trial_id uuid references public.trials (id) on delete set null,
  planned_assessment_id uuid references public.planned_assessments (id) on delete set null,
  channel text not null check (channel in ('push', 'email')),
  -- tipo do aviso, ex.: assessment_due (lista definida na Fase 4)
  kind text not null check (btrim(kind) <> '' and char_length(kind) <= 100),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  -- chave para nunca repetir o mesmo aviso; montar só com ids e datas (sem dado pessoal)
  dedupe_key text not null check (btrim(dedupe_key) <> '' and char_length(dedupe_key) <= 200),
  -- código técnico do erro (sem mensagem livre, que pode conter dado pessoal)
  error_code text check (char_length(error_code) <= 100),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_log_dedupe_key unique (dedupe_key)
);
comment on table public.notification_log is 'Avisos enviados; gravado só pelo serviço; sem e-mail, endpoint ou texto da mensagem.';

-- ---------------------------------------------------------------------------
-- Índices (por usuário e por data)
-- notification_preferences(user_id), push_subscriptions(user_id, endpoint), token_hash e dedupe_key
-- já são indexados pelas restrições únicas.
-- ---------------------------------------------------------------------------
create index calendar_feed_tokens_user_idx on public.calendar_feed_tokens (user_id, created_at);
create index calendar_feed_tokens_revoked_by_idx on public.calendar_feed_tokens (revoked_by);
create index notification_log_user_sent_idx on public.notification_log (user_id, sent_at);
create index notification_log_sent_idx on public.notification_log (sent_at);
create index notification_log_trial_idx on public.notification_log (trial_id);
create index notification_log_planned_assessment_idx on public.notification_log (planned_assessment_id);

create trigger set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.calendar_feed_tokens
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.notification_log
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guarda dos tokens: dono e hash imutáveis; revogação definitiva; coordenação só revoga token alheio.
-- ---------------------------------------------------------------------------
create or replace function public.calendar_feed_token_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.user_id := auth.uid();
      new.last_used_at := null;
      new.revoked_at := null;
      new.revoked_by := null;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.token_hash is distinct from old.token_hash
     or new.created_at is distinct from old.created_at then
    raise exception 'Token do feed não pode ser alterado: revogue e crie outro' using errcode = '42501';
  end if;

  if old.revoked_at is not null then
    if new.revoked_at is distinct from old.revoked_at
       or new.revoked_by is distinct from old.revoked_by
       or new.label is distinct from old.label then
      raise exception 'Token revogado não pode ser alterado nem reativado' using errcode = '42501';
    end if;
    return new;
  end if;

  if auth.uid() is not null and old.user_id <> auth.uid() and new.label is distinct from old.label then
    raise exception 'A coordenação só revoga tokens de outras pessoas' using errcode = '42501';
  end if;

  if new.revoked_at is not null then
    new.revoked_at := now();
    new.revoked_by := auth.uid();
  else
    new.revoked_by := null;
  end if;
  return new;
end;
$$;

create trigger calendar_feed_token_guard before insert or update on public.calendar_feed_tokens
  for each row execute function public.calendar_feed_token_guard();

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.calendar_feed_tokens enable row level security;
alter table public.notification_log enable row level security;

revoke all on public.notification_preferences, public.push_subscriptions,
  public.calendar_feed_tokens, public.notification_log from public, anon, authenticated;

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- token_hash e last_used_at fora do alcance do cliente; revoked_by preenchido pelo gatilho.
grant select (id, user_id, label, last_used_at, revoked_at, revoked_by, created_at, updated_at)
  on public.calendar_feed_tokens to authenticated;
grant insert (label, token_hash) on public.calendar_feed_tokens to authenticated;
grant update (label, revoked_at) on public.calendar_feed_tokens to authenticated;

grant select on public.notification_log to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas (só authenticated; service_role ignora RLS e é quem grava o log)
-- ---------------------------------------------------------------------------
-- notification_preferences: só o dono
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) is not null)
  with check (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);
create policy notification_preferences_delete_own on public.notification_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);

-- push_subscriptions: só o dono
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) is not null)
  with check (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);

-- calendar_feed_tokens: dono cria e revoga; coordenação vê metadados e revoga; sem DELETE
create policy calendar_feed_tokens_select_own_or_coordination on public.calendar_feed_tokens
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_coordination()));
create policy calendar_feed_tokens_insert_own on public.calendar_feed_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);
create policy calendar_feed_tokens_update_own_or_coordination on public.calendar_feed_tokens
  for update to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.current_app_role()) is not null)
    or (select public.is_coordination())
  )
  with check (
    (user_id = (select auth.uid()) and (select public.current_app_role()) is not null)
    or (select public.is_coordination())
  );

-- notification_log: leitura pelo dono e pela coordenação; nenhuma escrita por cliente
create policy notification_log_select_own_or_coordination on public.notification_log
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_coordination()));
