// Operações de autenticação (Supabase Auth). Recebem o cliente de servidor da requisição.
// Mensagens de erro são genéricas: não revelam se o e-mail existe (sem enumeração de usuários).
import { z } from "zod";
import { DataError } from "./errors";
import type { DbClient } from "./types";

/** Escopos pedidos à Microsoft: identidade e e-mail (o hook de domínio usa o e-mail). */
export const ESCOPOS_MICROSOFT = "openid profile email offline_access";

/** Parâmetros do signInWithOAuth para o provedor Microsoft (Entra ID) do Supabase ("azure"). */
export function opcoesOAuthMicrosoft(redirectTo: string) {
  return {
    provider: "azure" as const,
    options: { redirectTo, scopes: ESCOPOS_MICROSOFT, skipBrowserRedirect: true },
  };
}

/**
 * Monta a URL de autorização (PKCE). O verificador do PKCE fica em cookie pelo próprio cliente.
 * A URL aponta para o Supabase Auth, que redireciona ao tenant configurado nele.
 */
export async function iniciarLoginMicrosoft(db: DbClient, redirectTo: string): Promise<string> {
  const { data, error } = await db.auth.signInWithOAuth(opcoesOAuthMicrosoft(redirectTo));
  if (error || !data?.url) throw new DataError("unavailable", undefined, { cause: error });
  return data.url;
}

/** Troca o código do callback por sessão (grava os cookies pelo setAll do cliente). */
export async function trocarCodigoPorSessao(db: DbClient, codigo: string): Promise<void> {
  const { error } = await db.auth.exchangeCodeForSession(codigo);
  if (error) throw new DataError("unauthenticated", undefined, { cause: error });
}

export const credenciaisSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email("Informe um e-mail válido")),
  senha: z.string().min(1, "Informe a senha").max(200),
});

/** Login por senha: só para os usuários de teste do seed, no ambiente local (quem decide é a página). */
export async function entrarComSenha(db: DbClient, entrada: { email: unknown; senha: unknown }): Promise<void> {
  const r = credenciaisSchema.safeParse(entrada);
  if (!r.success) throw new DataError("invalid");
  const { error } = await db.auth.signInWithPassword({ email: r.data.email, password: r.data.senha });
  if (error) throw new DataError("unauthenticated", undefined, { cause: error });
}

/** Encerra a sessão deste aparelho e limpa os cookies. */
export async function sair(db: DbClient): Promise<void> {
  await db.auth.signOut({ scope: "local" });
}
