// ÚNICO módulo que usa o cliente com a chave secreta. Ignora a RLS: por padrão, ninguém o usa.
// Qualquer uso novo exige justificativa na tarefa e revisão do papel seguranca.
// O teste tests/security/secret-key-isolation.test.ts proíbe importá-lo fora de src/lib/data/server.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../../env.server";
import type { Database } from "../database.types";

export function createAdminSupabase() {
  const env = getServerEnv(); // valida no primeiro uso
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
