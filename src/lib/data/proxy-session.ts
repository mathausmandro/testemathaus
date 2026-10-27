// Sessão no proxy (src/proxy.ts): renova os cookies do Supabase e descobre se há perfil.
// Fica fora de data/server porque o proxy não carrega "server-only"; não usa a chave secreta.
// Falhas (variáveis ausentes, Supabase fora do ar) nunca liberam acesso: viram "anonimo" ou "erro".
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EstadoDaSessao } from "../auth/routes";
import { getPublicEnv } from "../env";
import { opcoesDoCookieDeSessao } from "./cookie-options";
import type { Database } from "./database.types";

export type SessaoNoProxy = { estado: EstadoDaSessao; response: NextResponse };

export async function atualizarSessaoNoProxy(request: NextRequest): Promise<SessaoNoProxy> {
  let response = NextResponse.next({ request });

  let env;
  try {
    env = getPublicEnv();
  } catch {
    return { estado: { tipo: "anonimo" }, response };
  }

  const db = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: opcoesDoCookieDeSessao(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, cabecalhos) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of lista) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(cabecalhos ?? {})) response.headers.set(k, v);
      },
    },
  });

  try {
    // getClaims valida o JWT (e renova a sessão se preciso) logo após criar o cliente.
    const { data, error } = await db.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) return { estado: { tipo: "anonimo" }, response };

    const { data: perfil, error: erroPerfil } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (erroPerfil) return { estado: { tipo: "erro" }, response };
    if (!perfil?.role) return { estado: { tipo: "sem_perfil" }, response };
    return { estado: { tipo: "com_perfil", perfil: perfil.role }, response };
  } catch {
    return { estado: { tipo: "erro" }, response };
  }
}
