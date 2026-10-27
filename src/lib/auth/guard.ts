// Regra única de acesso (pura): usada pelos helpers de página, Server Action e Route Handler.
import type { AppRole } from "../data/types";

export type SessaoMinima = { perfil: { role: AppRole | null } | null } | null;

export type ResultadoDoAcesso = "ok" | "sem_sessao" | "sem_perfil" | "sem_permissao";

/** Sem lista de perfis: basta ter qualquer perfil. Lista vazia nega todos. */
export function avaliarAcesso(sessao: SessaoMinima, permitidos?: readonly AppRole[]): ResultadoDoAcesso {
  if (!sessao) return "sem_sessao";
  const role = sessao.perfil?.role ?? null;
  if (!role) return "sem_perfil";
  if (permitidos && !permitidos.includes(role)) return "sem_permissao";
  return "ok";
}

export const NOMES_DOS_PERFIS: Readonly<Record<AppRole, string>> = {
  coordination: "Coordenação",
  field: "Campo",
  home_office: "Home office",
};
