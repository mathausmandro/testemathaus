// Cliente Supabase do navegador: só a chave publicável. A segurança real está na RLS.
import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "../../env";
import type { Database } from "../database.types";

export function createBrowserSupabase() {
  const env = getPublicEnv(); // valida no primeiro uso
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
