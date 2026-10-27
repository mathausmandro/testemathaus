// Erros padronizados da camada de dados. A mensagem é sempre em pt-BR e genérica:
// detalhes do banco (códigos, nomes de tabela, SQL) nunca chegam à interface.
// O erro original fica só em `cause`, para log no servidor.

export type DataErrorCode = "unauthenticated" | "forbidden" | "not_found" | "conflict" | "invalid" | "unavailable" | "internal";

const MENSAGENS: Record<DataErrorCode, string> = {
  unauthenticated: "Sua sessão expirou. Entre novamente.",
  forbidden: "Você não tem permissão para esta ação.",
  not_found: "Registro não encontrado.",
  conflict: "Já existe um registro com estes dados.",
  invalid: "Os dados informados são inválidos.",
  unavailable: "Serviço indisponível no momento. Tente novamente em instantes.",
  internal: "Não foi possível concluir a operação. Tente novamente.",
};

export class DataError extends Error {
  constructor(
    public readonly code: DataErrorCode,
    /** Campos inválidos (só para code "invalid"); mensagens já em pt-BR. */
    public readonly fields?: Record<string, string>,
    options?: { cause?: unknown },
  ) {
    super(MENSAGENS[code], options);
    this.name = "DataError";
  }
}

export function isDataError(e: unknown): e is DataError {
  return e instanceof DataError;
}

/** Forma mínima de um erro do PostgREST/Auth, sem depender do pacote. */
type ErroBruto = { code?: string; status?: number; message?: string } | null | undefined;

/** Traduz um erro bruto do Supabase para DataError, sem vazar detalhes. */
export function traduzirErro(erro: ErroBruto): DataError {
  const code = erro?.code ?? "";
  const status = erro?.status;
  let tipo: DataErrorCode = "internal";
  if (code === "42501" || status === 403) tipo = "forbidden"; // RLS ou privilégio negado
  else if (status === 401 || code === "PGRST301" || code === "PGRST303") tipo = "unauthenticated";
  else if (code === "PGRST116" || code === "P0002") tipo = "not_found";
  else if (code === "23505") tipo = "conflict";
  else if (["23502", "23503", "23514", "22P02", "22007", "22001", "22023"].includes(code)) tipo = "invalid";
  else if (status === 503 || status === 502 || status === 504) tipo = "unavailable";
  return new DataError(tipo, undefined, { cause: erro });
}
