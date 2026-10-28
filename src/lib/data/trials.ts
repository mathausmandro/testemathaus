import { z } from "zod";
import { traduzirErro } from "./errors";
import type { DbClient, Trial } from "./types";
import { paraErroDeCampos } from "./validation";

const COLUNAS =
  "id, code, contractor, crop, location, design, planned_start_date, planned_end_date, status, randomization_seed, technical_lead, created_by, created_at, updated_at";

const dataIso = z.iso.date("Data inválida (use AAAA-MM-DD)");
const textoOpcional = z
  .string()
  .trim()
  .max(200, "Texto longo demais")
  .transform((v) => (v === "" ? null : v))
  .nullish();

export const createTrialSchema = z
  .object({
    code: z.string({ error: "Informe o código do ensaio" }).trim().min(1, "Informe o código do ensaio").max(50, "Código longo demais"),
    contractor: textoOpcional,
    crop: textoOpcional,
    location: textoOpcional,
    technical_lead: textoOpcional,
    design: z.enum(["dbc", "dic", "factorial", "split_plot"], { error: "Delineamento inválido" }).nullish(),
    planned_start_date: dataIso.nullish(),
    planned_end_date: dataIso.nullish(),
  })
  .refine((v) => !v.planned_start_date || !v.planned_end_date || v.planned_end_date >= v.planned_start_date, {
    path: ["planned_end_date"],
    message: "A data final não pode ser anterior à inicial",
  });

export type CreateTrialInput = z.input<typeof createTrialSchema>;

const idSchema = z.uuid("Identificador inválido");

/** Lista os ensaios visíveis ao usuário (a RLS decide); uma única consulta, sem N+1. */
export async function listTrials(db: DbClient): Promise<Trial[]> {
  const { data, error } = await db.from("trials").select(COLUNAS).order("code", { ascending: true });
  if (error) throw traduzirErro(error);
  return data ?? [];
}

export async function getTrial(db: DbClient, id: string): Promise<Trial | null> {
  const r = idSchema.safeParse(id);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { data, error } = await db.from("trials").select(COLUNAS).eq("id", r.data).maybeSingle();
  if (error) throw traduzirErro(error);
  return data;
}

/** Cria um ensaio. Só coordination consegue: a RLS nega os demais perfis (erro "forbidden"). */
export async function createTrial(db: DbClient, input: CreateTrialInput): Promise<Trial> {
  const r = createTrialSchema.safeParse(input);
  if (!r.success) throw paraErroDeCampos(r.error);
  const { data, error } = await db.from("trials").insert(r.data).select(COLUNAS).single();
  if (error) throw traduzirErro(error);
  return data;
}
