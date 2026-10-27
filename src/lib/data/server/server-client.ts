// Cliente Supabase de servidor: criado por requisição (nunca global), com os cookies da sessão.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "../../env";
import type { Database } from "../database.types";

export async function createServerSupabase() {
  const env = getPublicEnv(); // valida no primeiro uso
  const store = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
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
