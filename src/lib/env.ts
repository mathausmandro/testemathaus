// Variáveis públicas (podem ir ao navegador). Este módulo é seguro para código de cliente.
// As leituras de process.env são literais de propósito: o Next só embute NEXT_PUBLIC_* assim.
import { z } from "zod";

const naoVazio = (nome: string) => z.string({ error: `${nome} não definida` }).trim().min(1, `${nome} não pode ser vazia`);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: naoVazio("NEXT_PUBLIC_SUPABASE_URL").pipe(z.url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: naoVazio("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export class EnvError extends Error {
  constructor(public readonly problemas: string[]) {
    super(
      `Variáveis de ambiente inválidas: ${problemas.join("; ")}. ` +
        "Copie .env.example para .env.local ou rode `node scripts/setup-local.mjs` com o Supabase local ligado.",
    );
    this.name = "EnvError";
  }
}

/** Valida uma origem de variáveis e lança EnvError em português se faltar algo. */
export function parseEnv<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const r = schema.safeParse(source);
  if (!r.success) throw new EnvError(r.error.issues.map((i) => i.message));
  return r.data;
}

export function getPublicEnv(): PublicEnv {
  return parseEnv(publicEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
