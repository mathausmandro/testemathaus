// Validação comum da camada de dados (zod): erros viram DataError("invalid") com mensagens por campo.
import { z } from "zod";
import { DataError } from "./errors";

export function paraErroDeCampos(e: z.ZodError): DataError {
  const campos: Record<string, string> = {};
  for (const i of e.issues) campos[i.path.join(".") || "_"] ??= i.message;
  return new DataError("invalid", campos);
}

export const idSchema = z.uuid("Identificador inválido");

/** Motivo de alteração de acesso (vai para change_history). Mesmo limite do banco: 3 a 500 caracteres. */
export const motivoSchema = z
  .string({ error: "Informe o motivo" })
  .trim()
  .min(3, "Informe o motivo (mínimo de 3 caracteres)")
  .max(500, "Motivo longo demais (máximo de 500 caracteres)");

/** Paginação de listagens: valores fora da faixa voltam ao padrão. */
export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100_000).catch(1),
  porPagina: z.coerce.number().int().min(1).max(100).catch(25),
});
