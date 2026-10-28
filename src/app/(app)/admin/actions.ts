"use server";
// Server Actions da administração (tarefa 015). Cada uma:
// 1. exige o perfil coordination no servidor (exigirPerfil) ANTES de ler o formulário;
// 2. valida a entrada com zod pelo utilitário compartilhado (src/lib/validation);
// 3. usa o cliente da sessão (chave publicável): a RLS e as RPCs SECURITY INVOKER do banco decidem
//    de novo. O cliente com chave secreta NÃO é usado aqui.
// CSRF: o Next.js só aceita Server Action com Origin igual ao Host (padrão; não há allowedOrigins).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPerfil } from "@/lib/auth/server";
import { verificarMudancaDePerfil } from "@/lib/auth/regras-de-perfil";
import { DataError } from "@/lib/data/errors";
import { countCoordination, getProfile, setUserRole } from "@/lib/data/profiles";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { addTrialMember, atribuirMembroSchema, removeTrialMember, retirarMembroSchema } from "@/lib/data/trial-members";
import { falha, falhaDe, lerFormulario, renomearCampos, sucesso, validarEntrada, type EstadoDaAcao } from "@/lib/validation";

/** Nomes da camada de dados para os nomes dos campos do formulário. */
const CAMPOS_DO_FORMULARIO = { reason: "motivo" };

/** Valida e devolve os campos com os nomes do formulário (reason → motivo). */
function validarComNomesDoFormulario<S extends z.ZodType>(schema: S, dados: unknown): z.output<S> {
  try {
    return validarEntrada(schema, dados);
  } catch (e) {
    if (e instanceof DataError && e.fields) throw renomearCampos(e, CAMPOS_DO_FORMULARIO);
    throw e;
  }
}

const confirmacao = z.literal("sim", { error: "Marque a confirmação para continuar" });

const formularioDePerfil = z
  .object({
    userId: z.uuid("Pessoa inválida"),
    perfil: z.enum(["coordination", "field", "home_office", "sem_perfil"], { error: "Perfil inválido" }),
    motivo: z.string({ error: "Informe o motivo" }),
    confirmar: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.perfil === "sem_perfil" && !confirmacao.safeParse(v.confirmar).success) {
      ctx.addIssue({ code: "custom", path: ["confirmar"], message: "Confirme a revogação do acesso" });
    }
  });

/** Atribui, altera ou revoga o perfil de uma pessoa. */
export async function definirPerfil(_anterior: EstadoDaAcao, form: FormData): Promise<EstadoDaAcao> {
  try {
    const { userId: atorId } = await exigirPerfil(["coordination"]);

    const f = lerFormulario(form, ["userId", "perfil", "motivo", "confirmar"]);
    const dados = validarEntrada(formularioDePerfil, { ...f, userId: f.userId ?? "", motivo: f.motivo ?? "" });
    const novoPapel = dados.perfil === "sem_perfil" ? null : dados.perfil;

    const db = await createServerSupabase();
    const alvo = await getProfile(db, dados.userId);
    if (!alvo) throw new DataError("not_found");
    if (alvo.role === novoPapel) return sucesso("O perfil já era este; nada foi alterado.");

    const recusa = verificarMudancaDePerfil({
      atorId,
      alvoId: alvo.id,
      papelAtual: alvo.role,
      novoPapel,
      totalCoordenacao: alvo.role === "coordination" ? await countCoordination(db) : 0,
    });
    if (recusa) return falha(recusa);

    // A validação do motivo (3 a 500) é a mesma de setUserRole; o campo volta como "motivo".
    try {
      await setUserRole(db, { userId: alvo.id, role: novoPapel, reason: dados.motivo });
    } catch (e) {
      if (e instanceof DataError && e.fields) throw renomearCampos(e, CAMPOS_DO_FORMULARIO);
      throw e;
    }

    revalidatePath("/admin", "layout");
    return sucesso(novoPapel ? "Perfil atualizado. A pessoa vê a mudança na próxima página que abrir." : "Acesso revogado.");
  } catch (e) {
    return falhaDe(e);
  }
}

/** Atribui uma pessoa a um ensaio (motivo opcional; sem ele, grava um contexto padrão). */
export async function atribuirAoEnsaio(_anterior: EstadoDaAcao, form: FormData): Promise<EstadoDaAcao> {
  try {
    await exigirPerfil(["coordination"]);
    const f = lerFormulario(form, ["trialId", "userId", "motivo"]);
    const entrada = validarComNomesDoFormulario(atribuirMembroSchema, {
      trialId: f.trialId ?? "",
      userId: f.userId ?? "",
      reason: f.motivo,
    });
    const db = await createServerSupabase();
    try {
      await addTrialMember(db, entrada);
    } catch (e) {
      if (e instanceof DataError && e.code === "conflict") return falha("Esta pessoa já está atribuída ao ensaio.");
      throw e;
    }
    revalidatePath("/admin", "layout");
    return sucesso("Pessoa atribuída ao ensaio.");
  } catch (e) {
    return falhaDe(e);
  }
}

/** Retira uma pessoa de um ensaio (motivo e confirmação obrigatórios). */
export async function removerDoEnsaio(_anterior: EstadoDaAcao, form: FormData): Promise<EstadoDaAcao> {
  try {
    await exigirPerfil(["coordination"]);
    const f = lerFormulario(form, ["trialId", "userId", "motivo", "confirmar"]);
    if (!confirmacao.safeParse(f.confirmar).success) {
      throw new DataError("invalid", { confirmar: "Confirme a retirada da pessoa" });
    }
    const entrada = validarComNomesDoFormulario(retirarMembroSchema, {
      trialId: f.trialId ?? "",
      userId: f.userId ?? "",
      reason: f.motivo ?? "",
    });
    const db = await createServerSupabase();
    await removeTrialMember(db, entrada);
    revalidatePath("/admin", "layout");
    return sucesso("Pessoa retirada do ensaio.");
  } catch (e) {
    return falhaDe(e);
  }
}

