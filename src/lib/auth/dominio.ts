// Segunda barreira do domínio de e-mail (achado M1 da revisão de segurança 003-019).
// A primeira é o hook no banco (public.hook_before_user_created). Aqui o app recusa a SESSÃO de quem
// não pertence a ALLOWED_EMAIL_DOMAIN (variável só do servidor; nunca NEXT_PUBLIC, nunca fixa no código).
// A regra é a mesma do hook: exatamente um @, sem espaços, domínio IGUAL ao permitido (sem
// subdomínio, sufixo ou prefixo), sem diferença de maiúsculas.
// Padrão seguro: sem ALLOWED_EMAIL_DOMAIN, nenhuma sessão é aceita, exceto os usuários fictícios
// do domínio reservado exemplo.test quando o modo local está ativo (loginLocalPermitido).
import { loginLocalPermitido, type FonteDeAmbiente } from "./config";

/** Domínio reservado (RFC 6761) dos usuários fictícios do seed local. */
export const DOMINIO_DE_TESTE_LOCAL = "exemplo.test";

export function normalizarDominio(dominio: string | null | undefined): string | null {
  const d = (dominio ?? "").trim().toLowerCase().replace(/^@+/, "");
  return d === "" ? null : d;
}

export function emailCorrespondeAoDominio(email: string | null | undefined, dominio: string | null | undefined): boolean {
  const d = normalizarDominio(dominio);
  const e = (email ?? "").trim().toLowerCase();
  if (!d || !e) return false;
  if (!/^[^@\s]+@[^@\s]+$/.test(e)) return false;
  return e.split("@")[1] === d;
}

/** A sessão deste e-mail pode ser usada no app? */
export function emailPermitidoNaSessao(email: string | null | undefined, env: FonteDeAmbiente): boolean {
  if (loginLocalPermitido(env) && emailCorrespondeAoDominio(email, DOMINIO_DE_TESTE_LOCAL)) return true;
  return emailCorrespondeAoDominio(email, env.ALLOWED_EMAIL_DOMAIN);
}

/** Variáveis usadas pela regra, lidas em tempo de execução (só no servidor). */
export function ambienteDoDominio(): FonteDeAmbiente {
  return {
    ALLOWED_EMAIL_DOMAIN: process.env.ALLOWED_EMAIL_DOMAIN,
    AUTH_LOCAL_PASSWORD_LOGIN: process.env.AUTH_LOCAL_PASSWORD_LOGIN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    APP_ENV: process.env.APP_ENV,
  };
}
