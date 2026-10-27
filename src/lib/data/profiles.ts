import { z } from "zod";
import { DataError, traduzirErro } from "./errors";
import type { AppRole, DbClient, Json, Profile } from "./types";
import { idSchema, motivoSchema, paginacaoSchema, paraErroDeCampos } from "./validation";

const COLUNAS = "id, email, full_name, role, created_at, updated_at";

export const PERFIS: readonly AppRole[] = ["coordination", "field", "home_office"];

/** Perfil do usuário da sessão. Retorna null se ainda não houver linha de perfil. */
export async function getOwnProfile(db: DbClient): Promise<Profile | null> {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) throw new DataError("unauthenticated", undefined, { cause: authError });
  const { data, error } = await db.from("profiles").select(COLUNAS).eq("id", auth.user.id).maybeSingle();
  if (error) throw traduzirErro(error);
  return data;
}

// ---------------------------------------------------------------------------
// Administração (tarefa 015). Só coordination enxerga outros perfis (RLS de profiles).
// ---------------------------------------------------------------------------

export type PessoaResumo = Pick<Profile, "id" | "email" | "full_name" | "role">;

export const listaDePessoasSchema = paginacaoSchema.extend({
  filtro: z.enum(["todos", "sem_perfil"]).catch("todos"),
});
export type ListaDePessoasEntrada = { pagina?: unknown; porPagina?: unknown; filtro?: unknown };
export type ListaDePessoas = { itens: Profile[]; total: number; pagina: number; porPagina: number; filtro: "todos" | "sem_perfil" };

/**
 * Pessoas, paginadas. Sem perfil primeiro (aguardando liberação), depois por perfil e nome.
 * Uma consulta só, com contagem exata.
 */
export async function listProfiles(db: DbClient, entrada: ListaDePessoasEntrada = {}): Promise<ListaDePessoas> {
  const { pagina, porPagina, filtro } = listaDePessoasSchema.parse(entrada);
  const inicio = (pagina - 1) * porPagina;
  let q = db
    .from("profiles")
    .select(COLUNAS, { count: "exact" })
    .order("role", { ascending: true, nullsFirst: true })
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true })
    .range(inicio, inicio + porPagina - 1);
  if (filtro === "sem_perfil") q = q.is("role", null);
  const { data, error, count } = await q;
  // Página além do fim (PostgREST 416): lista vazia, sem erro.
  if (error && error.code === "PGRST103") return { itens: [], total: count ?? 0, pagina, porPagina, filtro };
  if (error) throw traduzirErro(error);
  return { itens: data ?? [], total: count ?? 0, pagina, porPagina, filtro };
}

/** Pessoas para escolha em formulários (ex.: atribuir a ensaio). Limite de segurança de 1000. */
export async function listProfileOptions(db: DbClient): Promise<PessoaResumo[]> {
  const { data, error } = await db
    .from("profiles")
    .select("id, email, full_name, role")
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true })
    .limit(1000);
  if (error) throw traduzirErro(error);
  return data ?? [];
}

export async function getProfile(db: DbClient, id: string): Promise<Profile | null> {
  const r = idSchema.safeParse(id);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { data, error } = await db.from("profiles").select(COLUNAS).eq("id", r.data).maybeSingle();
  if (error) throw traduzirErro(error);
  return data;
}

/** Quantas pessoas têm o perfil coordination. */
export async function countCoordination(db: DbClient): Promise<number> {
  const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "coordination");
  if (error) throw traduzirErro(error);
  return count ?? 0;
}

export const definirPerfilSchema = z.object({
  userId: z.uuid("Pessoa inválida"),
  role: z.enum(["coordination", "field", "home_office"], { error: "Perfil inválido" }).nullable(),
  reason: motivoSchema,
});
export type DefinirPerfilEntrada = z.input<typeof definirPerfilSchema>;

/**
 * Atribui, altera ou revoga (role null) o perfil de uma pessoa, com motivo no histórico.
 * O banco (RPC admin_set_user_role, SECURITY INVOKER) nega quem não é coordination, a mudança
 * do próprio perfil e a remoção da última coordenação.
 */
export async function setUserRole(db: DbClient, entrada: DefinirPerfilEntrada): Promise<void> {
  const r = definirPerfilSchema.safeParse(entrada);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { error } = await db.rpc("admin_set_user_role", {
    p_user_id: r.data.userId,
    p_role: r.data.role,
    p_reason: r.data.reason,
  });
  if (error) throw traduzirErro(error);
}

/** Nomes das pessoas por id (para histórico); ids desconhecidos ficam de fora. */
export async function getProfileNames(db: DbClient, ids: readonly string[]): Promise<Map<string, PessoaResumo>> {
  const unicos = [...new Set(ids.filter((i) => idSchema.safeParse(i).success))];
  if (unicos.length === 0) return new Map();
  const { data, error } = await db.from("profiles").select("id, email, full_name, role").in("id", unicos);
  if (error) throw traduzirErro(error);
  return new Map((data ?? []).map((p) => [p.id, p]));
}

// ---------------------------------------------------------------------------
// Histórico de acessos (change_history, tarefa 008). Leitura só para coordination (RLS).
// ---------------------------------------------------------------------------

export type ItemDoHistorico = {
  id: string;
  operation: string;
  recordId: string;
  trialId: string | null;
  changedAt: string;
  reason: string | null;
  autor: PessoaResumo | null;
  /** Pessoa afetada (perfil alterado ou membro do ensaio). */
  pessoa: PessoaResumo | null;
  papelAnterior: AppRole | null;
  papelNovo: AppRole | null;
};

const COLUNAS_HISTORICO = "id, table_name, operation, record_id, trial_id, author_id, changed_at, reason, old_value, new_value";

function campo(v: Json | null, chave: string): string | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const x = (v as Record<string, Json | undefined>)[chave];
  return typeof x === "string" ? x : null;
}

function comoPapel(v: string | null): AppRole | null {
  return v && (PERFIS as readonly string[]).includes(v) ? (v as AppRole) : null;
}

type LinhaDoHistorico = {
  id: string;
  table_name: string;
  operation: string;
  record_id: string;
  trial_id: string | null;
  author_id: string | null;
  changed_at: string;
  reason: string | null;
  old_value: Json | null;
  new_value: Json | null;
};

/** Pessoa afetada por uma linha do histórico de acessos. */
export function pessoaAfetada(l: Pick<LinhaDoHistorico, "table_name" | "record_id" | "old_value" | "new_value">): string | null {
  if (l.table_name === "profiles") return l.record_id;
  return campo(l.new_value, "user_id") ?? campo(l.old_value, "user_id");
}

export async function montarHistorico(db: DbClient, linhas: LinhaDoHistorico[]): Promise<ItemDoHistorico[]> {
  const ids = linhas.flatMap((l) => [l.author_id, pessoaAfetada(l)]).filter((x): x is string => !!x);
  const nomes = await getProfileNames(db, ids);
  return linhas.map((l) => {
    const afetada = pessoaAfetada(l);
    return {
      id: l.id,
      operation: l.operation,
      recordId: l.record_id,
      trialId: l.trial_id,
      changedAt: l.changed_at,
      reason: l.reason,
      autor: l.author_id ? (nomes.get(l.author_id) ?? null) : null,
      pessoa: afetada ? (nomes.get(afetada) ?? null) : null,
      papelAnterior: l.table_name === "profiles" ? comoPapel(campo(l.old_value, "role")) : null,
      papelNovo: l.table_name === "profiles" ? comoPapel(campo(l.new_value, "role")) : null,
    };
  });
}

const limiteSchema = z.coerce.number().int().min(1).max(200).catch(20);

/** Últimas mudanças de perfil (de todos ou de uma pessoa), mais recentes primeiro. */
export async function listRoleHistory(db: DbClient, opcoes: { userId?: string; limite?: number } = {}): Promise<ItemDoHistorico[]> {
  const limite = limiteSchema.parse(opcoes.limite);
  let q = db
    .from("change_history")
    .select(COLUNAS_HISTORICO)
    .eq("table_name", "profiles")
    .order("changed_at", { ascending: false })
    .limit(limite);
  if (opcoes.userId !== undefined) {
    const r = idSchema.safeParse(opcoes.userId);
    if (!r.success) throw paraErroDeCampos(r.error);
    q = q.eq("record_id", r.data);
  }
  const { data, error } = await q;
  if (error) throw traduzirErro(error);
  return montarHistorico(db, data ?? []);
}
