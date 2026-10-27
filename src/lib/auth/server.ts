// Guardas de servidor. Use SEMPRE no início de:
// - páginas protegidas: exigirPerfilNaPagina(perfis?)  → redireciona (login/aguardando) ou 404;
// - Server Actions e Route Handlers: exigirSessao() / exigirPerfil(perfis?) → lança DataError padronizado.
// Esconder botão na tela não é segurança; o proxy também não é a única barreira.
import "server-only";
import { notFound, redirect } from "next/navigation";
import { DataError } from "../data/errors";
import { obterSessao, type Sessao } from "../data/server/session";
import type { AppRole, Profile } from "../data/types";
import { avaliarAcesso } from "./guard";
import { DESTINO_PADRAO } from "./redirect";
import { ROTA_AGUARDANDO, ROTA_LOGIN } from "./routes";

export type SessaoComPerfil = Sessao & { perfil: Profile & { role: AppRole } };

export async function exigirSessao(): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) throw new DataError("unauthenticated");
  return sessao;
}

export async function exigirPerfil(permitidos?: readonly AppRole[]): Promise<SessaoComPerfil> {
  const sessao = await obterSessao();
  const r = avaliarAcesso(sessao, permitidos);
  if (r === "sem_sessao") throw new DataError("unauthenticated");
  if (r !== "ok") throw new DataError("forbidden");
  return sessao as SessaoComPerfil;
}

export async function exigirPerfilNaPagina(permitidos?: readonly AppRole[]): Promise<SessaoComPerfil> {
  const sessao = await obterSessao();
  const r = avaliarAcesso(sessao, permitidos);
  if (r === "sem_sessao") redirect(ROTA_LOGIN);
  if (r === "sem_perfil") redirect(ROTA_AGUARDANDO);
  if (r === "sem_permissao") notFound(); // não revela que a área existe
  return sessao as SessaoComPerfil;
}

/** Para a tela "Aguardando liberação": exige sessão, mas não perfil. */
export async function exigirSessaoSemPerfilNaPagina(): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) redirect(ROTA_LOGIN);
  if (sessao.perfil?.role) redirect(DESTINO_PADRAO);
  return sessao;
}
