// Estado devolvido pelas Server Actions da administração (fica fora de actions.ts, que só exporta funções async).
import { isDataError } from "@/lib/data/errors";

export type EstadoDaAcao = {
  status: "ocioso" | "ok" | "erro";
  mensagem?: string;
  /** Mensagens por campo do formulário (pt-BR). */
  campos?: Record<string, string>;
};

export const ESTADO_INICIAL: EstadoDaAcao = { status: "ocioso" };

export function sucesso(mensagem: string): EstadoDaAcao {
  return { status: "ok", mensagem };
}

export function falha(mensagem: string, campos?: Record<string, string>): EstadoDaAcao {
  return { status: "erro", mensagem, campos };
}

/** Converte qualquer erro em estado de falha sem vazar detalhes internos. */
export function falhaDe(e: unknown): EstadoDaAcao {
  if (isDataError(e)) return falha(e.code === "invalid" && e.fields ? "Corrija os campos destacados." : e.message, e.fields);
  return falha("Não foi possível concluir a operação. Tente novamente.");
}
