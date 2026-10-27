// Membros de ensaio (trial_members), tarefa 015. Escrita só pela coordenação (RLS + RPCs SECURITY INVOKER),
// sempre com motivo/contexto no histórico (change_history).
import { z } from "zod";
import { traduzirErro } from "./errors";
import { montarHistorico, type ItemDoHistorico, type PessoaResumo } from "./profiles";
import type { DbClient } from "./types";
import { idSchema, motivoSchema, paraErroDeCampos } from "./validation";

export type MembroDoEnsaio = { id: string; trialId: string; userId: string; createdAt: string; pessoa: PessoaResumo | null };

/** Membros de um ensaio com os dados da pessoa (uma consulta, junção pela FK). */
export async function listTrialMembers(db: DbClient, trialId: string): Promise<MembroDoEnsaio[]> {
  const r = idSchema.safeParse(trialId);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { data, error } = await db
    .from("trial_members")
    .select("id, trial_id, user_id, created_at, pessoa:profiles!trial_members_user_id_fkey(id, email, full_name, role)")
    .eq("trial_id", r.data)
    .order("created_at", { ascending: true });
  if (error) throw traduzirErro(error);
  return (data ?? []).map((m) => ({
    id: m.id,
    trialId: m.trial_id,
    userId: m.user_id,
    createdAt: m.created_at,
    pessoa: (m.pessoa as PessoaResumo | null) ?? null,
  }));
}

/** Contexto gravado quando a coordenação não escreve um motivo ao atribuir alguém. */
export const CONTEXTO_PADRAO_DA_ATRIBUICAO = "Atribuição ao ensaio pela coordenação";

export const atribuirMembroSchema = z.object({
  trialId: z.uuid("Ensaio inválido"),
  userId: z.uuid("Escolha a pessoa"),
  reason: z
    .string()
    .trim()
    .max(500, "Motivo longo demais (máximo de 500 caracteres)")
    .optional()
    .transform((v) => (v && v.length >= 3 ? v : CONTEXTO_PADRAO_DA_ATRIBUICAO)),
});
export type AtribuirMembroEntrada = z.input<typeof atribuirMembroSchema>;

export const retirarMembroSchema = z.object({
  trialId: z.uuid("Ensaio inválido"),
  userId: z.uuid("Pessoa inválida"),
  reason: motivoSchema,
});
export type RetirarMembroEntrada = z.input<typeof retirarMembroSchema>;

/** Atribui a pessoa ao ensaio. Já atribuída: DataError "conflict". */
export async function addTrialMember(db: DbClient, entrada: AtribuirMembroEntrada): Promise<string> {
  const r = atribuirMembroSchema.safeParse(entrada);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { data, error } = await db.rpc("admin_add_trial_member", {
    p_trial_id: r.data.trialId,
    p_user_id: r.data.userId,
    p_reason: r.data.reason,
  });
  if (error) throw traduzirErro(error);
  return data;
}

/** Retira a pessoa do ensaio (motivo obrigatório). Não atribuída: DataError "not_found". */
export async function removeTrialMember(db: DbClient, entrada: RetirarMembroEntrada): Promise<void> {
  const r = retirarMembroSchema.safeParse(entrada);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { error } = await db.rpc("admin_remove_trial_member", {
    p_trial_id: r.data.trialId,
    p_user_id: r.data.userId,
    p_reason: r.data.reason,
  });
  if (error) throw traduzirErro(error);
}

/** Histórico de atribuições e retiradas de um ensaio, mais recentes primeiro. */
export async function listTrialMemberHistory(db: DbClient, trialId: string, limite = 20): Promise<ItemDoHistorico[]> {
  const r = idSchema.safeParse(trialId);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { data, error } = await db
    .from("change_history")
    .select("id, table_name, operation, record_id, trial_id, author_id, changed_at, reason, old_value, new_value")
    .eq("table_name", "trial_members")
    .eq("trial_id", r.data)
    .order("changed_at", { ascending: false })
    .limit(Math.min(Math.max(Math.trunc(limite) || 20, 1), 200));
  if (error) throw traduzirErro(error);
  return montarHistorico(db, data ?? []);
}
