import { DataError, traduzirErro } from "./errors";
import type { DbClient, Profile } from "./types";

const COLUNAS = "id, email, full_name, role, created_at, updated_at";

/** Perfil do usuário da sessão. Retorna null se ainda não houver linha de perfil. */
export async function getOwnProfile(db: DbClient): Promise<Profile | null> {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) throw new DataError("unauthenticated", undefined, { cause: authError });
  const { data, error } = await db.from("profiles").select(COLUNAS).eq("id", auth.user.id).maybeSingle();
  if (error) throw traduzirErro(error);
  return data;
}
