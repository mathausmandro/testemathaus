// Variáveis só de servidor. O import "server-only" faz o build falhar se este módulo
// for importado por código de cliente. Nunca reexporte estes valores para o navegador.
import "server-only";
import { z } from "zod";
import { parseEnv, publicEnvSchema } from "./env";

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SECRET_KEY: z
    .string({ error: "SUPABASE_SECRET_KEY não definida" })
    .trim()
    .min(1, "SUPABASE_SECRET_KEY não pode ser vazia"),
  // Valor pendente (domínio de e-mail da empresa): opcional até a tarefa de login; nunca fixado no código.
  ALLOWED_EMAIL_DOMAIN: z.string().trim().min(1, "ALLOWED_EMAIL_DOMAIN não pode ser vazia").optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return parseEnv(serverEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    // Variável de ambiente vazia (ALLOWED_EMAIL_DOMAIN=) conta como ausente.
    ALLOWED_EMAIL_DOMAIN: process.env.ALLOWED_EMAIL_DOMAIN || undefined,
  });
}
