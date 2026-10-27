-- Tarefa 008: histórico imutável (change_history) e gatilhos.
-- NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
-- Validar com: npx supabase db reset && npx supabase test db
--
-- Como o motivo chega ao banco (contrato para a camada src/lib/data, tarefa 011):
-- 1. Preferencial: coluna change_reason no próprio UPDATE (ex.: .update({ value_numeric: 12, change_reason: 'Erro de digitação' })).
--    O gatilho lê, grava em change_history e LIMPA a coluna (ela nunca guarda valor; o próximo UPDATE precisa de novo motivo).
-- 2. Alternativa (RPC/transação): select set_config('app.change_reason', 'motivo', true) antes do UPDATE.
-- 3. Na anulação, voided_reason também vale como motivo.
-- UPDATE em dado de campo sem motivo falha com "Motivo obrigatório".
--
-- O que é registrado:
-- - field_records, field_record_photos, applications, occurrences, quality_flags: INSERT (AFTER, só se a
--   linha entrou; ON CONFLICT DO NOTHING não gera histórico) e UPDATE (com valor anterior, novo e motivo).
-- - UPDATE que só muda updated_at (ou nada) não gera histórico nem exige motivo.
-- - profiles: mudança de role. trial_members: inclusão, alteração e remoção (rastreio de acessos). Motivo opcional
--   (app.change_reason).
--
-- Imutabilidade: sem política de INSERT/UPDATE/DELETE para clientes; INSERT só pelos gatilhos (SECURITY DEFINER);
-- UPDATE/DELETE/TRUNCATE revogados e bloqueados por gatilho até para o dono do banco. autor = auth.uid(), sempre
-- sobrescrito por gatilho. Risco residual documentado: um superusuário ou migration pode desligar gatilhos;
-- qualquer migration que toque change_history deve passar por revisão do papel seguranca.

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
create table public.change_history (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  -- sem FK: o histórico sobrevive a qualquer exclusão permitida (ex.: ensaio sem dado de campo)
  trial_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  -- auth.uid() de quem fez; nulo em operação de sistema (seed, migration, service_role sem usuário)
  author_id uuid,
  -- papel da requisição (authenticated, service_role) ou usuário do banco em operação de sistema
  actor_role text,
  changed_at timestamptz not null default clock_timestamp(),
  reason text,
  old_value jsonb,
  new_value jsonb
);
comment on table public.change_history is 'Histórico imutável: só aceita inclusão, feita pelos gatilhos.';

create index change_history_trial_changed_idx on public.change_history (trial_id, changed_at);
create index change_history_record_idx on public.change_history (table_name, record_id);
create index change_history_author_idx on public.change_history (author_id);

-- ---------------------------------------------------------------------------
-- Proteção da própria tabela
-- ---------------------------------------------------------------------------
-- Carimbo: autor, papel e hora vêm sempre do contexto, nunca do valor enviado.
create or replace function public.change_history_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  new.actor_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    session_user::text
  );
  new.changed_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.change_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'change_history só aceita inclusão' using errcode = '42501';
end;
$$;

create trigger change_history_stamp before insert on public.change_history
  for each row execute function public.change_history_stamp();
create trigger change_history_no_update_delete before update or delete on public.change_history
  for each row execute function public.change_history_immutable();
create trigger change_history_no_truncate before truncate on public.change_history
  for each statement execute function public.change_history_immutable();

alter table public.change_history enable row level security;
revoke all on public.change_history from public, anon, authenticated, service_role;
grant select on public.change_history to authenticated, service_role;

-- Leitura: coordination tudo; membros com papel, o histórico dos ensaios atribuídos.
-- Registros sem ensaio (mudança de role em profiles) só para coordination.
create policy change_history_select_member_or_coordination on public.change_history
  for select to authenticated
  using ((select public.is_coordination()) or (trial_id is not null and public.has_trial_access(trial_id)));

-- ---------------------------------------------------------------------------
-- Coluna de motivo nas tabelas de campo (só de passagem; o gatilho limpa)
-- ---------------------------------------------------------------------------
alter table public.field_records add column change_reason text;
alter table public.field_record_photos add column change_reason text;
alter table public.applications add column change_reason text;
alter table public.occurrences add column change_reason text;
alter table public.quality_flags add column change_reason text;

comment on column public.field_records.change_reason is 'Motivo da alteração; lido pelo gatilho, gravado em change_history e limpo.';
comment on column public.field_record_photos.change_reason is 'Motivo da alteração; lido pelo gatilho, gravado em change_history e limpo.';
comment on column public.applications.change_reason is 'Motivo da alteração; lido pelo gatilho, gravado em change_history e limpo.';
comment on column public.occurrences.change_reason is 'Motivo da alteração; lido pelo gatilho, gravado em change_history e limpo.';
comment on column public.quality_flags.change_reason is 'Motivo da alteração; lido pelo gatilho, gravado em change_history e limpo.';

-- ---------------------------------------------------------------------------
-- Gatilhos de histórico dos dados de campo
-- ---------------------------------------------------------------------------
-- BEFORE INSERT OR UPDATE (nome zz_ para rodar depois de field_row_guard e set_updated_at).
create or replace function public.capture_field_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_old jsonb;
  v_new jsonb;
begin
  v_reason := nullif(btrim(coalesce(new.change_reason, '')), '');
  if v_reason is null then
    v_reason := nullif(btrim(coalesce(current_setting('app.change_reason', true), '')), '');
  end if;
  new.change_reason := null;

  -- A inclusão é registrada no AFTER INSERT, que só dispara se a linha realmente entrar.
  if tg_op = 'INSERT' then
    return new;
  end if;

  v_old := to_jsonb(old) - 'change_reason';
  v_new := to_jsonb(new) - 'change_reason';
  if (v_old - 'updated_at') = (v_new - 'updated_at') then
    return new;
  end if;

  if v_reason is null
     and (v_new ->> 'status') = 'voided'
     and (v_old ->> 'status') is distinct from 'voided' then
    v_reason := nullif(btrim(coalesce(v_new ->> 'voided_reason', '')), '');
  end if;

  if v_reason is null then
    raise exception 'Motivo obrigatório para alterar % (envie change_reason)', tg_table_name
      using hint = 'Preencha a coluna change_reason no UPDATE ou app.change_reason na transação.';
  end if;

  insert into public.change_history (table_name, record_id, trial_id, operation, reason, old_value, new_value)
  values (tg_table_name, new.id, new.trial_id, 'UPDATE', v_reason, v_old, v_new);
  return new;
end;
$$;

-- AFTER INSERT: registra a criação com o valor inicial.
create or replace function public.log_field_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.change_history (table_name, record_id, trial_id, operation, reason, old_value, new_value)
  values (tg_table_name, new.id, new.trial_id, 'INSERT', null, null, to_jsonb(new) - 'change_reason');
  return null;
end;
$$;

-- Rastreio de acessos: role em profiles e membros de ensaio.
create or replace function public.log_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(current_setting('app.change_reason', true), '')), '');
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;
  v_row := coalesce(v_new, v_old);

  -- profiles: guarda só o papel (minimização de dados pessoais).
  if tg_table_name = 'profiles' then
    v_old := case when v_old is null then null else jsonb_build_object('role', v_old -> 'role') end;
    v_new := case when v_new is null then null else jsonb_build_object('role', v_new -> 'role') end;
  end if;

  insert into public.change_history (table_name, record_id, trial_id, operation, reason, old_value, new_value)
  values (tg_table_name, (v_row ->> 'id')::uuid, (v_row ->> 'trial_id')::uuid, tg_op, v_reason, v_old, v_new);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.capture_field_change() from public, anon, authenticated;
revoke execute on function public.log_field_insert() from public, anon, authenticated;
revoke execute on function public.log_access_change() from public, anon, authenticated;

create trigger zz_capture_change before insert or update on public.field_records
  for each row execute function public.capture_field_change();
create trigger zz_capture_change before insert or update on public.field_record_photos
  for each row execute function public.capture_field_change();
create trigger zz_capture_change before insert or update on public.applications
  for each row execute function public.capture_field_change();
create trigger zz_capture_change before insert or update on public.occurrences
  for each row execute function public.capture_field_change();
create trigger zz_capture_change before insert or update on public.quality_flags
  for each row execute function public.capture_field_change();

create trigger zz_log_insert after insert on public.field_records
  for each row execute function public.log_field_insert();
create trigger zz_log_insert after insert on public.field_record_photos
  for each row execute function public.log_field_insert();
create trigger zz_log_insert after insert on public.applications
  for each row execute function public.log_field_insert();
create trigger zz_log_insert after insert on public.occurrences
  for each row execute function public.log_field_insert();
create trigger zz_log_insert after insert on public.quality_flags
  for each row execute function public.log_field_insert();

create trigger log_role_change after update of role on public.profiles
  for each row when (old.role is distinct from new.role)
  execute function public.log_access_change();
create trigger log_membership_change after insert or update or delete on public.trial_members
  for each row execute function public.log_access_change();
