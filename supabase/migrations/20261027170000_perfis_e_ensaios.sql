-- Tarefa 005: perfis, ensaios, atribuição (trial_members) e RLS base.
-- NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
-- Validar com: npx supabase db reset && npx supabase test db
--
-- Decisões:
-- - O papel é lido nas políticas por funções SECURITY DEFINER com search_path vazio,
--   para não haver recursão de política em profiles.
-- - current_role é palavra reservada no Postgres; a função se chama current_app_role().
-- - Status do ensaio: texto com CHECK provisório (lista pendente com o Mathaus); trocar
--   um CHECK por migration é simples, ao contrário de remover valor de enum.
-- - Datas previstas do ensaio são date (só dia, sem hora); timestamptz geraria troca de dia
--   ao converter para America/Sao_Paulo.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('coordination', 'field', 'home_office');

-- Delineamentos citados no plano: DBC, DIC, fatorial e parcelas subdivididas.
create type public.trial_design as enum ('dbc', 'dic', 'factorial', 'split_plot');

-- ---------------------------------------------------------------------------
-- Função genérica de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  -- null = aguardando liberação pela coordenação
  role public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Pessoa com acesso ao sistema; role nula até a coordenação liberar.';

create table public.trials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  contractor text,
  crop text,
  location text,
  design public.trial_design,
  planned_start_date date,
  planned_end_date date,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  -- semente do sorteio da casualização (regra 8); nula até a casualização
  randomization_seed bigint,
  technical_lead text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trials_planned_dates_check
    check (planned_end_date is null or planned_start_date is null or planned_end_date >= planned_start_date)
);
comment on column public.trials.randomization_seed is 'Semente do sorteio da casualização; mesma semente, mesmo resultado.';
comment on column public.trials.status is 'Lista provisória; confirmar com o Mathaus (tarefa 005).';

create table public.trial_members (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trial_members_trial_user_key unique (trial_id, user_id)
);
comment on table public.trial_members is 'Quem está atribuído a cada ensaio; base da regra de visibilidade.';

-- Índice usado pelas políticas (busca por usuário) e pela listagem de ensaios.
create index trial_members_user_trial_idx on public.trial_members (user_id, trial_id);
create index profiles_role_idx on public.profiles (role);
create index trials_created_by_idx on public.trials (created_by);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.trials
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.trial_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções de papel e pertencimento (SECURITY DEFINER, search_path fixo)
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;
comment on function public.current_app_role() is 'Papel do usuário logado (null se sem perfil).';

create or replace function public.is_coordination()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'coordination' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Usuário com papel e atribuído ao ensaio (não considera coordination).
create or replace function public.is_trial_member(p_trial_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trial_members m
    join public.profiles p on p.id = m.user_id
    where m.trial_id = p_trial_id
      and m.user_id = auth.uid()
      and p.role is not null
  );
$$;

-- Pode ver o ensaio: coordination vê todos; field e home_office só os atribuídos.
create or replace function public.has_trial_access(p_trial_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role = 'coordination'
        or (
          p.role is not null
          and exists (
            select 1 from public.trial_members m
            where m.trial_id = p_trial_id and m.user_id = p.id
          )
        )
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

-- Pode gravar dado de campo no ensaio: coordination ou field atribuído.
create or replace function public.can_record_field_data(p_trial_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role = 'coordination'
        or (
          p.role = 'field'
          and exists (
            select 1 from public.trial_members m
            where m.trial_id = p_trial_id and m.user_id = p.id
          )
        )
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

-- Pode conferir qualidade no ensaio: coordination ou home_office atribuído.
create or replace function public.can_review_trial(p_trial_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role = 'coordination'
        or (
          p.role = 'home_office'
          and exists (
            select 1 from public.trial_members m
            where m.trial_id = p_trial_id and m.user_id = p.id
          )
        )
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_coordination() from public, anon;
revoke execute on function public.is_trial_member(uuid) from public, anon;
revoke execute on function public.has_trial_access(uuid) from public, anon;
revoke execute on function public.can_record_field_data(uuid) from public, anon;
revoke execute on function public.can_review_trial(uuid) from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.is_coordination() to authenticated, service_role;
grant execute on function public.is_trial_member(uuid) to authenticated, service_role;
grant execute on function public.has_trial_access(uuid) to authenticated, service_role;
grant execute on function public.can_record_field_data(uuid) to authenticated, service_role;
grant execute on function public.can_review_trial(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Criação automática do perfil (role nula) ao criar usuário em auth.users
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Proteção contra auto-promoção: só coordination muda role, e nunca o próprio.
-- Operações de sistema (sem auth.uid(), fora de anon/authenticated) são permitidas.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.email is distinct from old.email then
    if auth.uid() is not null or current_user in ('anon', 'authenticated') then
      raise exception 'id e e-mail do perfil não podem ser alterados'
        using errcode = '42501';
    end if;
  end if;

  if new.role is distinct from old.role then
    if auth.uid() is null then
      if current_user in ('anon', 'authenticated') then
        raise exception 'Sem permissão para alterar o perfil' using errcode = '42501';
      end if;
    elsif old.id = auth.uid() then
      raise exception 'Ninguém pode alterar o próprio perfil de acesso' using errcode = '42501';
    elsif not public.is_coordination() then
      raise exception 'Só a coordenação altera perfis de acesso' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- RLS: ligada e negada por padrão; políticas só para authenticated
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trials enable row level security;
alter table public.trial_members enable row level security;

-- Privilégios: anon não toca em nada; colunas de profiles restritas.
revoke all on public.profiles from anon;
revoke all on public.trials from anon;
revoke all on public.trial_members from anon;
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, role) on public.profiles to authenticated;
revoke truncate on public.trials from authenticated;
revoke truncate on public.trial_members from authenticated;

-- profiles
create policy profiles_select_own_or_coordination on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_coordination()));

create policy profiles_update_own_or_coordination on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_coordination()))
  with check (id = (select auth.uid()) or (select public.is_coordination()));

-- trials
create policy trials_select_member_or_coordination on public.trials
  for select to authenticated
  using (public.has_trial_access(id));

create policy trials_insert_coordination on public.trials
  for insert to authenticated
  with check ((select public.is_coordination()));

create policy trials_update_coordination on public.trials
  for update to authenticated
  using ((select public.is_coordination()))
  with check ((select public.is_coordination()));

create policy trials_delete_coordination on public.trials
  for delete to authenticated
  using ((select public.is_coordination()));

-- trial_members
create policy trial_members_select_member_or_coordination on public.trial_members
  for select to authenticated
  using (public.has_trial_access(trial_id));

create policy trial_members_insert_coordination on public.trial_members
  for insert to authenticated
  with check ((select public.is_coordination()));

create policy trial_members_update_coordination on public.trial_members
  for update to authenticated
  using ((select public.is_coordination()))
  with check ((select public.is_coordination()));

create policy trial_members_delete_coordination on public.trial_members
  for delete to authenticated
  using ((select public.is_coordination()));
