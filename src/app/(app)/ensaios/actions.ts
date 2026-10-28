"use server";
// Server Action do cadastro de ensaio (tarefa 016). Exige coordination no servidor ANTES de ler o formulário,
// valida com zod (createTrialSchema, pelo utilitário compartilhado src/lib/validation) e grava com o cliente da sessão: a RLS do banco nega os demais perfis.
// CSRF: o Next.js só aceita Server Action com Origin igual ao Host.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/server";
import { DataError } from "@/lib/data/errors";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { createTrial, createTrialSchema } from "@/lib/data/trials";
import { falhaDe, validarFormulario, type EstadoDaAcao } from "@/lib/validation";

const CAMPOS = ["code", "contractor", "crop", "location", "technical_lead", "design", "planned_start_date", "planned_end_date"] as const;

export async function criarEnsaio(_anterior: EstadoDaAcao, form: FormData): Promise<EstadoDaAcao> {
  let id: string;
  try {
    await exigirPerfil(["coordination"]);
    // Campo ausente ou vazio vira undefined (opcional); o zod valida o restante.
    const entrada = validarFormulario(createTrialSchema, form, CAMPOS, { vazioComoAusente: true });
    const db = await createServerSupabase();
    try {
      id = (await createTrial(db, entrada)).id;
    } catch (e) {
      if (e instanceof DataError && e.code === "conflict") {
        throw new DataError("invalid", { code: "Já existe um ensaio com este código" });
      }
      throw e;
    }
  } catch (e) {
    return falhaDe(e);
  }
  revalidatePath("/ensaios");
  redirect(`/ensaios/${id}`); // fora do try: redirect lança por design
}
