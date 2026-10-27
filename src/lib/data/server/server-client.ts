// Cliente Supabase de servidor: criado por requisição (nunca global), com os cookies da sessão.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "../../env";
import { opcoesDoCookieDeSessao } from "../cookie-options";
import type { Database } from "../database.types";

export async function createServerSupabase() {
  const env = getPublicEnv(); // valida no primeiro uso
  const store = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: opcoesDoCookieDeSessao(),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Chamado de Server Component (cookies somente leitura): o proxy renova a sessão.
        }
      },
    },
  });
}

/** Nomes dos cookies de sessão do Supabase (sb-<ref>-auth-token, partes .0/.1 e verificador do PKCE). */
export const COOKIE_DE_SESSAO = /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;

/** Remove os cookies de sessão (garantia extra do logout, mesmo se o Auth não responder). */
export async function limparCookiesDaSessao(): Promise<void> {
  const store = await cookies();
  for (const { name } of store.getAll()) if (COOKIE_DE_SESSAO.test(name)) store.delete(name);
}
