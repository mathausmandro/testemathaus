// Leitura do protocolo de um ensaio (tratamentos e parcelas), tarefa 016. Só leitura: a escrita do protocolo
// (cadastro, casualização) vem na Fase 2. A RLS decide o que cada perfil enxerga.
import { traduzirErro } from "./errors";
import type { DbClient } from "./types";
import { idSchema, paraErroDeCampos } from "./validation";

export type TratamentoResumo = {
  id: string;
  number: number;
  name: string;
  product: string | null;
  dose: number | null;
  dose_unit: string | null;
  timing: string | null;
};

export type ParcelaResumo = {
  id: string;
  number: number;
  block: number | null;
  grid_row: number | null;
  grid_column: number | null;
  treatment_id: string | null;
  /** Tratamento da parcela (resolvido em memória a partir da lista de tratamentos; sem N+1). */
  treatment: { number: number; name: string } | null;
};

function validarId(id: string): string {
  const r = idSchema.safeParse(id);
  if (!r.success) throw paraErroDeCampos(r.error);
  return r.data;
}

export async function listTreatments(db: DbClient, trialId: string): Promise<TratamentoResumo[]> {
  const id = validarId(trialId);
  const { data, error } = await db
    .from("treatments")
    .select("id, number, name, product, dose, dose_unit, timing")
    .eq("trial_id", id)
    .order("number", { ascending: true });
  if (error) throw traduzirErro(error);
  return data ?? [];
}

/** Parcelas ordenadas por número, já com o tratamento de cada uma (recebe a lista de tratamentos do mesmo ensaio). */
export async function listPlots(db: DbClient, trialId: string, tratamentos: readonly TratamentoResumo[]): Promise<ParcelaResumo[]> {
  const id = validarId(trialId);
  const { data, error } = await db
    .from("plots")
    .select("id, number, block, grid_row, grid_column, treatment_id")
    .eq("trial_id", id)
    .order("number", { ascending: true });
  if (error) throw traduzirErro(error);
  const porId = new Map(tratamentos.map((t) => [t.id, t]));
  return (data ?? []).map((p) => {
    const t = p.treatment_id ? porId.get(p.treatment_id) : undefined;
    return { ...p, treatment: t ? { number: t.number, name: t.name } : null };
  });
}
