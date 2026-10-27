-- Tarefa 007: dados de campo (registros, fotos, aplicações, ocorrências, conferência) e bucket de fotos.
-- NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
-- Validar com: npx supabase db reset && npx supabase test db
--
-- Decisões:
-- - Registros de campo nunca são excluídos: sem política de DELETE, DELETE/TRUNCATE revogados e gatilho
--   que bloqueia até para o dono do banco. Anulação = UPDATE de status para 'voided' com motivo.
-- - client_id: uuid gerado no aparelho, único. Reenvio do mesmo id falha com 23505 (unique_violation);
--   a fila offline usa INSERT ... ON CONFLICT (client_id) DO NOTHING e confere pelo client_id.
-- - created_by é sempre auth.uid() (gatilho), nunca o valor enviado pelo cliente.
-- - trial_id direto em toda tabela (políticas sem junção) com FKs compostas (x_id, trial_id) para
--   impedir referência a parcela/avaliação/registro de outro ensaio.
-- - FKs sem cascade: parcela, avaliação prevista ou ensaio com registro de campo não podem ser excluídos.
-- - O histórico (change_history) e o motivo obrigatório de edição entram na tarefa 008.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.field_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  trial_id uuid not null references public.trials (id),
  plot_id uuid not null,
  planned_assessment_id uuid not null,
  value_numeric numeric,
  value_text text,
  -- data e hora da coleta no aparelho
  recorded_at timestamptz not null default now(),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  location_accuracy_m numeric check (location_accuracy_m >= 0),
  notes text,
  status text not null default 'valid' check (status in ('valid', 'voided')),
  voided_reason text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_records_client_id_key unique (client_id),
  constraint field_records_id_trial_key unique (id, trial_id),
  constraint field_records_plot_fkey foreign key (plot_id, trial_id)
    references public.plots (id, trial_id),
  constraint field_records_planned_assessment_fkey foreign key (planned_assessment_id, trial_id)
    references public.planned_assessments (id, trial_id),
  constraint field_records_void_check check (
    (status = 'valid' and voided_reason is null and voided_by is null and voided_at is null)
    or (status = 'voided' and nullif(btrim(voided_reason), '') is not null and voided_at is not null)
  )
);
comment on column public.field_records.client_id is 'Id gerado no aparelho; chave de idempotência da fila offline.';

create table public.field_record_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  trial_id uuid not null references public.trials (id),
  field_record_id uuid not null,
  -- caminho no bucket privado field-photos: <trial_id>/<field_record_id>/<arquivo>
  storage_path text not null,
  taken_at timestamptz,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  location_accuracy_m numeric check (location_accuracy_m >= 0),
  status text not null default 'valid' check (status in ('valid', 'voided')),
  voided_reason text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_record_photos_client_id_key unique (client_id),
  constraint field_record_photos_storage_path_key unique (storage_path),
  constraint field_record_photos_path_trial_check check (split_part(storage_path, '/', 1) = trial_id::text),
  constraint field_record_photos_record_fkey foreign key (field_record_id, trial_id)
    references public.field_records (id, trial_id),
  constraint field_record_photos_void_check check (
    (status = 'valid' and voided_reason is null and voided_by is null and voided_at is null)
    or (status = 'voided' and nullif(btrim(voided_reason), '') is not null and voided_at is not null)
  )
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  trial_id uuid not null references public.trials (id),
  applied_at timestamptz not null,
  equipment text,
  spray_volume numeric check (spray_volume >= 0),
  spray_volume_unit text,
  temperature_c numeric,
  relative_humidity_pct numeric check (relative_humidity_pct between 0 and 100),
  wind_speed_kmh numeric check (wind_speed_kmh >= 0),
  operator_name text,
  notes text,
  status text not null default 'valid' check (status in ('valid', 'voided')),
  voided_reason text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_client_id_key unique (client_id),
  constraint applications_void_check check (
    (status = 'valid' and voided_reason is null and voided_by is null and voided_at is null)
    or (status = 'voided' and nullif(btrim(voided_reason), '') is not null and voided_at is not null)
  )
);

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  trial_id uuid not null references public.trials (id),
  -- parcela opcional (ocorrência pode ser do ensaio inteiro)
  plot_id uuid,
  occurred_at timestamptz not null,
  description text not null check (btrim(description) <> ''),
  status text not null default 'valid' check (status in ('valid', 'voided')),
  voided_reason text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occurrences_client_id_key unique (client_id),
  constraint occurrences_plot_fkey foreign key (plot_id, trial_id)
    references public.plots (id, trial_id),
  constraint occurrences_void_check check (
    (status = 'valid' and voided_reason is null and voided_by is null and voided_at is null)
    or (status = 'voided' and nullif(btrim(voided_reason), '') is not null and voided_at is not null)
  )
);

create table public.quality_flags (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id),
  -- registro conferido; nulo quando a observação é sobre o ensaio
  field_record_id uuid,
  status text not null default 'open' check (status in ('open', 'checked', 'correction_requested')),
  comment text,
  handled_by uuid references public.profiles (id),
  handled_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_flags_record_fkey foreign key (field_record_id, trial_id)
    references public.field_records (id, trial_id)
);

-- ---------------------------------------------------------------------------
-- Índices (políticas por trial_id e created_by; junções por parcela/registro)
-- client_id já é indexado pela restrição única.
-- ---------------------------------------------------------------------------
create index field_records_trial_idx on public.field_records (trial_id);
create index field_records_plot_idx on public.field_records (plot_id);
create index field_records_planned_assessment_idx on public.field_records (planned_assessment_id);
create index field_records_created_by_idx on public.field_records (created_by);
create index field_record_photos_trial_idx on public.field_record_photos (trial_id);
create index field_record_photos_record_idx on public.field_record_photos (field_record_id);
create index field_record_photos_created_by_idx on public.field_record_photos (created_by);
create index applications_trial_idx on public.applications (trial_id);
create index applications_created_by_idx on public.applications (created_by);
create index occurrences_trial_idx on public.occurrences (trial_id);
create index occurrences_plot_idx on public.occurrences (plot_id);
create index occurrences_created_by_idx on public.occurrences (created_by);
create index quality_flags_trial_idx on public.quality_flags (trial_id);
create index quality_flags_record_idx on public.quality_flags (field_record_id);

-- ---------------------------------------------------------------------------
-- Gatilhos de guarda
-- ---------------------------------------------------------------------------
-- Registros de campo anuláveis: autor = auth.uid(); identificação imutável; anulado é final.
create or replace function public.field_row_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    if new.status is distinct from 'valid' then
      raise exception 'Registro de campo deve ser criado como válido' using errcode = '23514';
    end if;
    new.voided_reason := null;
    new.voided_by := null;
    new.voided_at := null;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.client_id is distinct from old.client_id
     or new.trial_id is distinct from old.trial_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Identificação do registro de campo não pode ser alterada' using errcode = '42501';
  end if;

  if old.status = 'voided' then
    raise exception 'Registro anulado não pode ser alterado' using errcode = '55000';
  end if;

  if new.status = 'voided' then
    new.voided_at := now();
    new.voided_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Conferência: autor = auth.uid(); quem tratou e quando registrados na troca de situação.
create or replace function public.quality_flag_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    if new.status = 'open' then
      new.handled_by := null;
      new.handled_at := null;
    else
      new.handled_by := coalesce(auth.uid(), new.created_by);
      new.handled_at := now();
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.trial_id is distinct from old.trial_id
     or new.field_record_id is distinct from old.field_record_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Identificação da conferência não pode ser alterada' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    new.handled_by := auth.uid();
    new.handled_at := now();
  else
    new.handled_by := old.handled_by;
    new.handled_at := old.handled_at;
  end if;
  return new;
end;
$$;

-- Bloqueio de DELETE e TRUNCATE (vale também para o dono do banco e para service_role).
create or replace function public.prevent_field_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registros de campo não são excluídos (%): anule com motivo', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger field_row_guard before insert or update on public.field_records
  for each row execute function public.field_row_guard();
create trigger field_row_guard before insert or update on public.field_record_photos
  for each row execute function public.field_row_guard();
create trigger field_row_guard before insert or update on public.applications
  for each row execute function public.field_row_guard();
create trigger field_row_guard before insert or update on public.occurrences
  for each row execute function public.field_row_guard();
create trigger field_row_guard before insert or update on public.quality_flags
  for each row execute function public.quality_flag_guard();

create trigger prevent_delete before delete on public.field_records
  for each row execute function public.prevent_field_delete();
create trigger prevent_delete before delete on public.field_record_photos
  for each row execute function public.prevent_field_delete();
create trigger prevent_delete before delete on public.applications
  for each row execute function public.prevent_field_delete();
create trigger prevent_delete before delete on public.occurrences
  for each row execute function public.prevent_field_delete();
create trigger prevent_delete before delete on public.quality_flags
  for each row execute function public.prevent_field_delete();

create trigger prevent_truncate before truncate on public.field_records
  for each statement execute function public.prevent_field_delete();
create trigger prevent_truncate before truncate on public.field_record_photos
  for each statement execute function public.prevent_field_delete();
create trigger prevent_truncate before truncate on public.applications
  for each statement execute function public.prevent_field_delete();
create trigger prevent_truncate before truncate on public.occurrences
  for each statement execute function public.prevent_field_delete();
create trigger prevent_truncate before truncate on public.quality_flags
  for each statement execute function public.prevent_field_delete();

create trigger set_updated_at before update on public.field_records
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.field_record_photos
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.occurrences
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.quality_flags
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privilégios e RLS
-- ---------------------------------------------------------------------------
alter table public.field_records enable row level security;
alter table public.field_record_photos enable row level security;
alter table public.applications enable row level security;
alter table public.occurrences enable row level security;
alter table public.quality_flags enable row level security;

revoke all on public.field_records, public.field_record_photos, public.applications,
  public.occurrences, public.quality_flags from anon;
revoke delete, truncate on public.field_records, public.field_record_photos, public.applications,
  public.occurrences, public.quality_flags from authenticated, service_role;

-- field_records: leitura por membros; gravação por field atribuído e coordination;
-- field só altera os próprios; home_office não grava.
create policy field_records_select_member_or_coordination on public.field_records
  for select to authenticated using (public.has_trial_access(trial_id));
create policy field_records_insert_field_or_coordination on public.field_records
  for insert to authenticated with check (public.can_record_field_data(trial_id));
create policy field_records_update_own_or_coordination on public.field_records
  for update to authenticated
  using ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)))
  with check ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)));

create policy field_record_photos_select_member_or_coordination on public.field_record_photos
  for select to authenticated using (public.has_trial_access(trial_id));
create policy field_record_photos_insert_field_or_coordination on public.field_record_photos
  for insert to authenticated with check (public.can_record_field_data(trial_id));
create policy field_record_photos_update_own_or_coordination on public.field_record_photos
  for update to authenticated
  using ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)))
  with check ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)));

create policy applications_select_member_or_coordination on public.applications
  for select to authenticated using (public.has_trial_access(trial_id));
create policy applications_insert_field_or_coordination on public.applications
  for insert to authenticated with check (public.can_record_field_data(trial_id));
create policy applications_update_own_or_coordination on public.applications
  for update to authenticated
  using ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)))
  with check ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)));

create policy occurrences_select_member_or_coordination on public.occurrences
  for select to authenticated using (public.has_trial_access(trial_id));
create policy occurrences_insert_field_or_coordination on public.occurrences
  for insert to authenticated with check (public.can_record_field_data(trial_id));
create policy occurrences_update_own_or_coordination on public.occurrences
  for update to authenticated
  using ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)))
  with check ((select public.is_coordination()) or (created_by = (select auth.uid()) and public.can_record_field_data(trial_id)));

-- quality_flags: home_office atribuído e coordination criam e tratam; field só lê.
create policy quality_flags_select_member_or_coordination on public.quality_flags
  for select to authenticated using (public.has_trial_access(trial_id));
create policy quality_flags_insert_reviewer on public.quality_flags
  for insert to authenticated with check (public.can_review_trial(trial_id));
create policy quality_flags_update_reviewer on public.quality_flags
  for update to authenticated
  using (public.can_review_trial(trial_id))
  with check (public.can_review_trial(trial_id));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado de fotos (só imagens, 10 MiB) e políticas por ensaio
-- Caminho obrigatório: <trial_id>/<field_record_id>/<arquivo>. Sem UPDATE/DELETE: foto é imutável.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'field-photos', 'field-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ensaio a partir do primeiro segmento do caminho; null se não for uuid (evita erro de conversão).
create or replace function public.storage_object_trial_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;
revoke execute on function public.storage_object_trial_id(text) from public, anon;
grant execute on function public.storage_object_trial_id(text) to authenticated, service_role;

create policy field_photos_select_member_or_coordination on storage.objects
  for select to authenticated
  using (
    bucket_id = 'field-photos'
    and public.storage_object_trial_id(name) is not null
    and public.has_trial_access(public.storage_object_trial_id(name))
  );

create policy field_photos_insert_field_or_coordination on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'field-photos'
    and public.storage_object_trial_id(name) is not null
    and public.can_record_field_data(public.storage_object_trial_id(name))
  );
