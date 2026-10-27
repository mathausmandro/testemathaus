-- Tarefa 015: administração de perfis e atribuição de ensaios pela coordenação.
-- NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
-- Validar com: npx supabase db reset && npx supabase test db
--
-- O que esta migration acrescenta (sem alterar as anteriores):
-- 1. Garantia de que o sistema nunca fica sem coordination (gatilho com trava transacional).
--    A 005 já impede que alguém altere o próprio perfil; faltava o caso de duas coordenações
--    se rebaixarem ao mesmo tempo (cada uma ainda vê a outra como coordination antes do commit)
--    e operações de sistema (SQL direto) que removam a última coordenação.
-- 2. Funções RPC de administração (SECURITY INVOKER: a RLS e os gatilhos da 005 e da 008 valem
--    normalmente). Elas existem para levar o motivo ao histórico na MESMA transação do UPDATE
--    ou do INSERT/DELETE (app.change_reason, lido por log_access_change, tarefa 008); pelo
--    PostgREST não há outro jeito de fazer set_config e a alteração juntos.
--
-- Bootstrap do primeiro coordination: ver docs/auth-microsoft.md, seção "Primeira coordenação".
-- O gatilho abaixo não atrapalha o bootstrap (só age quando uma coordenação deixa de existir).

-- ---------------------------------------------------------------------------
-- 1. Nunca deixar o sistema sem coordination
-- ---------------------------------------------------------------------------
create or replace function public.protect_last_coordination()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restantes integer;
begin
  -- Só interessa quando uma coordenação deixa de existir.
  if tg_op = 'UPDATE' then
    if old.role is distinct from 'coordination'::public.app_role
       or new.role is not distinct from old.role then
      return new;
    end if;
  elsif old.role is distinct from 'coordination'::public.app_role then
    return old;
  end if;

  -- Serializa as mudanças que tiram alguém da coordenação. Cada comando abaixo enxerga o que
  -- as transações concorrentes já confirmaram (READ COMMITTED: novo snapshot por comando).
  perform pg_advisory_xact_lock(hashtext('public.profiles:last_coordination'));

  -- Quem age precisa continuar sendo coordination depois da espera (pode ter sido rebaixado).
  if auth.uid() is not null and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coordination'::public.app_role
  ) then
    raise exception 'Só a coordenação altera perfis de acesso' using errcode = '42501';
  end if;

  select count(*) into v_restantes
  from public.profiles p
  where p.role = 'coordination'::public.app_role
    and p.id <> old.id;

  if v_restantes = 0 then
    raise exception 'O sistema precisa ter ao menos uma pessoa na coordenação'
      using errcode = '23514',
            hint = 'Atribua o perfil de coordenação a outra pessoa antes de remover este.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_last_coordination() from public, anon, authenticated;

-- zz_: roda depois de protect_profile_columns e set_updated_at (gatilhos BEFORE disparam em ordem
-- alfabética), para que a mensagem de "próprio perfil"/"só a coordenação" da 005 venha primeiro.
create trigger zz_protect_last_coordination before update of role on public.profiles
  for each row execute function public.protect_last_coordination();
create trigger zz_protect_last_coordination_delete before delete on public.profiles
  for each row execute function public.protect_last_coordination();

-- ---------------------------------------------------------------------------
-- 2. RPCs de administração (SECURITY INVOKER)
-- ---------------------------------------------------------------------------
-- Motivo: obrigatório, 3 a 500 caracteres depois de tirar espaços das pontas.
create or replace function public.admin_valid_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v) < 3 or char_length(v) > 500 then
    raise exception 'Motivo obrigatório (3 a 500 caracteres)' using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Atribui, altera ou revoga (p_role nulo) o perfil de uma pessoa.
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.app_role, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
  v_linhas integer;
begin
  if not public.is_coordination() then
    raise exception 'Só a coordenação altera perfis de acesso' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'Pessoa não informada' using errcode = '22023';
  end if;
  v_reason := public.admin_valid_reason(p_reason);

  perform set_config('app.change_reason', v_reason, true);
  update public.profiles set role = p_role where id = p_user_id;
  get diagnostics v_linhas = row_count;
  perform set_config('app.change_reason', '', true);

  if v_linhas = 0 then
    raise exception 'Pessoa não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- Atribui uma pessoa a um ensaio. Devolve o id da linha de trial_members.
create or replace function public.admin_add_trial_member(p_trial_id uuid, p_user_id uuid, p_reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
  v_id uuid;
begin
  if not public.is_coordination() then
    raise exception 'Só a coordenação atribui pessoas a ensaios' using errcode = '42501';
  end if;
  if p_trial_id is null or p_user_id is null then
    raise exception 'Ensaio e pessoa são obrigatórios' using errcode = '22023';
  end if;
  v_reason := public.admin_valid_reason(p_reason);

  perform set_config('app.change_reason', v_reason, true);
  insert into public.trial_members (trial_id, user_id) values (p_trial_id, p_user_id)
  returning id into v_id;
  perform set_config('app.change_reason', '', true);
  return v_id;
end;
$$;

-- Retira uma pessoa de um ensaio.
create or replace function public.admin_remove_trial_member(p_trial_id uuid, p_user_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
  v_linhas integer;
begin
  if not public.is_coordination() then
    raise exception 'Só a coordenação retira pessoas de ensaios' using errcode = '42501';
  end if;
  if p_trial_id is null or p_user_id is null then
    raise exception 'Ensaio e pessoa são obrigatórios' using errcode = '22023';
  end if;
  v_reason := public.admin_valid_reason(p_reason);

  perform set_config('app.change_reason', v_reason, true);
  delete from public.trial_members where trial_id = p_trial_id and user_id = p_user_id;
  get diagnostics v_linhas = row_count;
  perform set_config('app.change_reason', '', true);

  if v_linhas = 0 then
    raise exception 'Atribuição não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_valid_reason(text) from public, anon;
revoke execute on function public.admin_set_user_role(uuid, public.app_role, text) from public, anon;
revoke execute on function public.admin_add_trial_member(uuid, uuid, text) from public, anon;
revoke execute on function public.admin_remove_trial_member(uuid, uuid, text) from public, anon;
grant execute on function public.admin_valid_reason(text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role, text) to authenticated;
grant execute on function public.admin_add_trial_member(uuid, uuid, text) to authenticated;
grant execute on function public.admin_remove_trial_member(uuid, uuid, text) to authenticated;

-- Listagem de histórico por pessoa/ensaio na tela de administração.
create index if not exists change_history_table_changed_idx on public.change_history (table_name, changed_at desc);
