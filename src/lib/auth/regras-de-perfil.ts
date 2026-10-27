// Regras de mudança de perfil (puras). O banco garante as mesmas regras (tarefas 005 e 015);
// aqui elas servem para responder cedo e com mensagem clara, sem depender do erro do banco.
import type { AppRole } from "../data/types";

export type MudancaDePerfil = {
  atorId: string;
  alvoId: string;
  papelAtual: AppRole | null;
  novoPapel: AppRole | null;
  /** Quantas pessoas têm coordination hoje (incluindo o alvo, se for o caso). */
  totalCoordenacao: number;
};

export const MENSAGEM_PROPRIO_PERFIL = "Você não pode alterar o próprio perfil. Peça a outra pessoa da coordenação.";
export const MENSAGEM_ULTIMA_COORDENACAO =
  "Esta é a última pessoa na coordenação. Atribua o perfil de coordenação a outra pessoa antes de alterar este.";

/** Devolve a mensagem de recusa, ou null se a mudança é permitida. */
export function verificarMudancaDePerfil(m: MudancaDePerfil): string | null {
  if (m.papelAtual === m.novoPapel) return null; // nada muda
  if (m.atorId === m.alvoId) return MENSAGEM_PROPRIO_PERFIL;
  if (m.papelAtual === "coordination" && m.totalCoordenacao <= 1) return MENSAGEM_ULTIMA_COORDENACAO;
  return null;
}
