// Sessão e perfil do usuário no servidor (páginas, Server Actions e Route Handlers).
// getUser() confirma o token no Supabase Auth (não confia só no cookie). Uma leitura por requisição (cache do React).
import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { getOwnProfile } from "../profiles";
import type { Profile } from "../types";
import { createServerSupabase } from "./server-client";

export type Sessao = { userId: string; email: string | null; perfil: Profile | null };

export const obterSessao = cache(async (): Promise<Sessao | null> => {
  // Sempre em tempo de requisição: sem isto, faltando variáveis no build, o resultado (deslogado)
  // seria congelado na página estática.
  await connection();
  let db;
  try {
    db = await createServerSupabase();
  } catch {
    return null; // variáveis ausentes: ninguém está logado
  }
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const perfil = await getOwnProfile(db);
  return { userId: data.user.id, email: data.user.email ?? null, perfil };
});
