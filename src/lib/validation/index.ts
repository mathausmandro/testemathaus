// Validação de entrada compartilhada (tarefa 017) para Server Actions e Route Handlers.
// Padrão único:
//   1. guarda de sessão/perfil (src/lib/auth/server.ts) ANTES de ler a entrada;
//   2. lerFormulario/lerParametros → validarEntrada(schema, dados) (zod);
//   3. erro → falhaDe(e): mensagem fixa em pt-BR, campos com mensagens do schema, sem stack trace,
//      sem mensagem do banco e sem detalhes do zod.
// tests/security/validacao-entrada.test.ts varre src/app e cobra este padrão em toda ação e rota.
// Módulo seguro para cliente (os formulários importam ESTADO_INICIAL e os tipos).
import type { z } from "zod";
import { DataError, isDataError } from "../data/errors";
import { paraErroDeCampos } from "../data/validation";

/** Tamanho máximo aceito em um campo de texto antes mesmo do schema (proteção contra payload enorme). */
export const LIMITE_DO_CAMPO = 10_000;

export const MENSAGEM_CAMPOS_INVALIDOS = "Corrija os campos destacados.";
export const MENSAGEM_ERRO_GENERICO = "Não foi possível concluir a operação. Tente novamente.";

/** Valida com zod; entrada inválida lança DataError("invalid") com mensagens por campo (pt-BR). */
export function validarEntrada<S extends z.ZodType>(schema: S, entrada: unknown): z.output<S> {
  const r = schema.safeParse(entrada);
  if (!r.success) throw paraErroDeCampos(r.error);
  return r.data;
}

type Fonte = { get(nome: string): FormDataEntryValue | string | null };

function lerCampos<K extends string>(fonte: Fonte, campos: readonly K[], vazioComoAusente: boolean): Record<K, string | undefined> {
  const saida = {} as Record<K, string | undefined>;
  for (const c of campos) {
    const v = fonte.get(c);
    // Arquivo, ausente ou grande demais: ausente (o schema decide se o campo é obrigatório).
    if (typeof v !== "string" || v.length > LIMITE_DO_CAMPO) saida[c] = undefined;
    else saida[c] = vazioComoAusente && v.trim() === "" ? undefined : v;
  }
  return saida;
}

/**
 * Lê só os campos listados de um FormData (o resto é ignorado: nada de campo extra chegando ao banco).
 * Com `vazioComoAusente`, campo em branco vira undefined (útil para campos opcionais).
 */
export function lerFormulario<K extends string>(
  form: FormData,
  campos: readonly K[],
  opcoes: { vazioComoAusente?: boolean } = {},
): Record<K, string | undefined> {
  return lerCampos(form, campos, opcoes.vazioComoAusente ?? false);
}

/** Mesmo que lerFormulario, para a query string de Route Handlers. */
export function lerParametros<K extends string>(params: URLSearchParams, campos: readonly K[]): Record<K, string | undefined> {
  return lerCampos(params, campos, false);
}

/** Atalho: lê os campos do formulário e valida. */
export function validarFormulario<S extends z.ZodType, K extends string>(
  schema: S,
  form: FormData,
  campos: readonly K[],
  opcoes: { vazioComoAusente?: boolean } = {},
): z.output<S> {
  return validarEntrada(schema, lerFormulario(form, campos, opcoes));
}

// ---------- Estado devolvido pelas Server Actions com formulário (useActionState) ----------

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

/** Converte qualquer erro em estado de falha sem vazar detalhes internos (só mensagens fixas). */
export function falhaDe(e: unknown): EstadoDaAcao {
  if (isDataError(e)) {
    if (e.code === "invalid" && e.fields) return falha(MENSAGEM_CAMPOS_INVALIDOS, { ...e.fields });
    return falha(e.message);
  }
  return falha(MENSAGEM_ERRO_GENERICO);
}

/** Renomeia campos de um DataError (nomes da camada de dados → nomes do formulário). */
export function renomearCampos(e: DataError, mapa: Record<string, string>): DataError {
  const campos = Object.fromEntries(Object.entries(e.fields ?? {}).map(([k, v]) => [mapa[k] ?? k, v]));
  return new DataError("invalid", campos);
}
