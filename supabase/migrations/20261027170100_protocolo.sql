-- Tarefa 006: estrutura do protocolo (fatores, níveis, tratamentos, parcelas, variáveis e avaliações previstas).
-- NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
-- Validar com: npx supabase db reset && npx supabase test db
--
-- Decisões:
-- - Toda tabela tem trial_id direto: as políticas usam has_trial_access(trial_id) sem junção.
-- - Chaves estrangeiras compostas (id, trial_id) garantem que filhos referenciem pais do MESMO ensaio
--   (ex.: parcela só aponta tratamento do próprio ensaio).
-- - Só estrutura: nenhuma regra de casualização nem de cálculo de datas (Fase 2).
-- - planned_date é date (data prevista, só dia); timestamptz trocaria o dia em America/Sao_Paulo.
-- - Exclusão de parcelas com registro de campo: bloqueada na 007 pela FK (sem cascade) de field_records.

-- ---------------------------------------------------------------------------
-- Fatores e níveis (fatorial e parcelas subdivididas)
-- ---------------------------------------------------------------------------
create table public.factors (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint factors_id_trial_key unique (id, trial_id),
  constraint factors_trial_name_key unique (trial_id, name)
);

create table public.factor_levels (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  factor_id uuid not null,
  name text not null check (btrim(name) <> ''),
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint factor_levels_id_trial_key unique (id, trial_id),
  constraint factor_levels_factor_name_key unique (factor_id, name),
  constraint factor_levels_factor_fkey foreign key (factor_id, trial_id)
    references public.factors (id, trial_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Tratamentos e vínculo com níveis de fator
-- ---------------------------------------------------------------------------
create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  number integer not null check (number > 0),
  name text not null check (btrim(name) <> ''),
  product text,
  active_ingredient text,
  dose numeric check (dose >= 0),
  dose_unit text,
  formulation text,
  -- época de aplicação, texto livre do protocolo
  timing text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatments_id_trial_key unique (id, trial_id),
  constraint treatments_trial_number_key unique (trial_id, number)
);

create table public.treatment_factor_levels (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  treatment_id uuid not null,
  factor_level_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_factor_levels_key unique (treatment_id, factor_level_id),
  constraint treatment_factor_levels_treatment_fkey foreign key (treatment_id, trial_id)
    references public.treatments (id, trial_id) on delete cascade,
  constraint treatment_factor_levels_level_fkey foreign key (factor_level_id, trial_id)
    references public.factor_levels (id, trial_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Parcelas
-- ---------------------------------------------------------------------------
create table public.plots (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  number integer not null check (number > 0),
  -- nulo no DIC (sem blocos)
  block integer check (block > 0),
  -- nulo até a casualização
  treatment_id uuid,
  -- parcela principal, só em parcelas subdivididas
  main_plot_id uuid,
  -- posição no croqui (linha e coluna da grade)
  grid_row integer,
  grid_column integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plots_id_trial_key unique (id, trial_id),
  constraint plots_trial_number_key unique (trial_id, number),
  constraint plots_main_plot_not_self check (main_plot_id is null or main_plot_id <> id),
  constraint plots_treatment_fkey foreign key (treatment_id, trial_id)
    references public.treatments (id, trial_id)
);

alter table public.plots
  add constraint plots_main_plot_fkey foreign key (main_plot_id, trial_id)
  references public.plots (id, trial_id);

-- ---------------------------------------------------------------------------
-- Variáveis de avaliação e avaliações previstas
-- ---------------------------------------------------------------------------
create table public.assessment_variables (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  unit text,
  method text,
  scale text,
  min_value numeric,
  max_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_variables_id_trial_key unique (id, trial_id),
  constraint assessment_variables_range_check
    check (min_value is null or max_value is null or min_value <= max_value)
);

create table public.planned_assessments (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials (id) on delete cascade,
  variable_id uuid not null,
  -- momento: dias após o evento de referência (plantio ou aplicação)
  days_after integer,
  reference_event text check (reference_event in ('planting', 'application')),
  planned_date date,
  responsible_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_assessments_id_trial_key unique (id, trial_id),
  constraint planned_assessments_moment_check check ((days_after is null) = (reference_event is null)),
  constraint planned_assessments_variable_fkey foreign key (variable_id, trial_id)
    references public.assessment_variables (id, trial_id)
);

-- ---------------------------------------------------------------------------
-- Índices (trial_id para as políticas; chaves de junção)
-- ---------------------------------------------------------------------------
create index factor_levels_trial_idx on public.factor_levels (trial_id);
create index treatment_factor_levels_trial_idx on public.treatment_factor_levels (trial_id);
create index treatment_factor_levels_level_idx on public.treatment_factor_levels (factor_level_id);
create index plots_treatment_idx on public.plots (treatment_id);
create index plots_main_plot_idx on public.plots (main_plot_id);
create index assessment_variables_trial_idx on public.assessment_variables (trial_id);
create index planned_assessments_trial_idx on public.planned_assessments (trial_id);
create index planned_assessments_variable_idx on public.planned_assessments (variable_id);
create index planned_assessments_responsible_idx on public.planned_assessments (responsible_id);
-- factors, treatments e plots: o índice único (trial_id, ...) já cobre trial_id.

-- ---------------------------------------------------------------------------
-- updated_at, privilégios, RLS e políticas (leitura: membros e coordination; escrita: coordination)
-- ---------------------------------------------------------------------------
-- factors
create trigger set_updated_at before update on public.factors
  for each row execute function public.set_updated_at();
alter table public.factors enable row level security;
revoke all on public.factors from anon;
revoke truncate on public.factors from authenticated;
create policy factors_select_member_or_coordination on public.factors
  for select to authenticated using (public.has_trial_access(trial_id));
create policy factors_insert_coordination on public.factors
  for insert to authenticated with check ((select public.is_coordination()));
create policy factors_update_coordination on public.factors
  for update to authenticated
  using ((select public.is_coordination())) with check ((select public.is_coordination()));
create policy factors_delete_coordination on public.factors
  for delete to authenticated using ((select public.is_coordination()));

-- factor_levels
create trigger set_updated_at before update on public.factor_levels
  for each row execute function public.set_updated_at();
alter table public.factor_levels enable row level security;
revoke all on public.factor_levels from anon;
revoke truncate on public.factor_levels from authenticated;
create policy factor_levels_select_member_or_coordination on public.factor_levels
  for select to authenticated using (public.has_trial_access(trial_id));
create policy factor_levels_insert_coordination on public.factor_levels
  for insert to authenticated with check ((select public.is_coordination()));
create policy factor_levels_update_coordination on public.factor_levels
  for update to authenticated
  using ((select public.is_coordination())) with check ((select public.is_coordination()));
create policy factor_levels_delete_coordination on public.factor_levels
  for delete to authenticated using ((select public.is_coordination()));

-- treatments
create trigger set_updated_at before update on public.treatments
  for each row execute function public.set_updated_at();
alter table public.treatments enable row level security;
revoke all on public.treatments from anon;
revoke truncate on public.treatments from authenticated;
create policy treatments_select_member_or_coordination on public.treatments
  for select to authenticated using (public.has_trial_access(trial_id));
create policy treatments_insert_coordination on public.treatments
  for insert to authenticated with check ((select public.is_coordination()));
create policy treatments_update_coordination on public.treatments
  for update to authenticated
  using ((select public.is_coordination())) with check ((select public.is_coordination()));
create policy treatments_delete_coordination on public.treatments
  for delete to authenticated using ((select public.is_coordination()));

-- treatment_factor_levels
create trigger set_updated_at before update on public.treatment_factor_levels
  for each row execute function public.set_updated_at();
alter table public.treatment_factor_levels enable row level security;
revoke all on public.treatment_factor_levels from anon;
revoke truncate on public.treatment_factor_levels from authenticated;
create policy treatment_factor_levels_select_member_or_coordination on public.treatment_factor_levels
  for select to authenticated using (public.has_trial_access(trial_id));
create policy treatment_factor_levels_insert_coordination on public.treatment_factor_levels
  for insert to authenticated with check ((select public.is_coordination()));
create policy treatment_factor_levels_update_coordination on public.treatment_factor_levels
  for update to authenticated
  using ((select public.is_coordination())) with check ((select public.is_coordination()));
create policy treatment_factor_levels_delete_coordination on public.treatment_factor_levels
  for delete to authenticated using ((select public.is_coordination()));

-- plots
create trigger set_updated_at before update on public.plots
  for each row execute function public.set_updated_at();
alter table public.plots enable row level security;
revoke all on public.plots from anon;
revoke truncate on public.plots from authenticated;
create policy plots_select_member_or_coordination on public.plots
  for select to authenticated using (public.has_trial_access(trial_id));
create policy plots_insert_coordination on public.plots
  for insert to authenticated with check ((select public.is_coordination()));
create policy plots_update_coordination on public.plots
  for update to authenticated
  using ((select public.is_coordination())) with check ((select public.is_coordination()));
create policy plots_delete_coordination on public.plots
  for delete to authenticated using ((select public.is_coordination()));

-- assessment_variables
create trigger set_updated_at before update on public.assessment_variables
  for each row execute function public.set_updated_at();
alter table public.assessment_variables enable row level security;
revoke all on public.assessment_variables from anon;
revoke truncate on public.assessment_variables from authenticated;
create policy assessment_variables_select_member_or_coordination on public.assessment_variables
  for select to authenticated using (public.has_trial_access(trial_id));
create policy assessment_variables_insert_coordination on public.assessment_variables
  for insert to authenticated with check ((select public.is_coordination()));
create policy assessment_variables_update_coordination on public.assessment_variables
  for update to authenticated
  using ((select public.is_coordination())) with check ((select public.is_coordination()));
create policy assessment_variables_delete_coordination on public.assessment_variables
  for delete to authenticated using ((select public.is_coordination()));

-- planned_assessments
create trigger set_updated_at before update on public.planned_assessments
  for each row execute function public.set_updated_at();
alter table public.planned_assessments enable row level security;
revoke all on public.planned_assessments from anon;
revoke truncate on public.planned_assessments from authenticated;
create policy planned_assessments_select_member_or_coordination on public.planned_assessments
  for select to authenticated using (public.has_trial_access(trial_id));
create policy planned_assessments_insert_coordination on public.planned_assessments
  for insert to authenticated with check ((select public.is_coordination()));
create policy planned_assessments_update_coordination on public.planned_assessments
  for update to authenticated
  using ((select public.is_coordination())) with check ((select public.is_coordination()));
create policy planned_assessments_delete_coordination on public.planned_assessments
  for delete to authenticated using ((select public.is_coordination()));

