// Grava ALLOWED_EMAIL_DOMAIN na configuração do hook de domínio (app_private.auth_settings).
//   npm run auth:domain                 lê .env.local (ou o ambiente) e grava no Supabase apontado
// Usa a função public.set_auth_email_domain, executável só pelo service_role (SUPABASE_SECRET_KEY).
// Domínio vazio desliga todos os cadastros novos (padrão seguro do hook). Nenhum valor é impresso.
// Roda em qualquer ambiente (local, teste, produção) desde que as variáveis apontem para ele.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DOMINIO = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * Normaliza e valida o domínio (mesma regra do CHECK da migration). Vazio vira null.
 * @param {string | undefined} bruto
 * @returns {string | null}
 */
export function normalizarDominio(bruto) {
  const v = (bruto ?? "").trim().replace(/^@+/, "").toLowerCase();
  if (v === "") return null;
  if (!DOMINIO.test(v)) throw new Error("ALLOWED_EMAIL_DOMAIN inválido: use só o domínio, sem @ nem espaços (ex.: empresa.com.br).");
  return v;
}

/**
 * Monta a chamada RPC ao PostgREST.
 * @param {{ url: string, chave: string, dominio: string | null }} p
 */
export function montarRequisicao({ url, chave, dominio }) {
  const base = new URL(url);
  return {
    endpoint: new URL("/rest/v1/rpc/set_auth_email_domain", base).toString(),
    init: {
      method: "POST",
      headers: { apikey: chave, "Content-Type": "application/json" },
      body: JSON.stringify({ p_domain: dominio }),
    },
  };
}

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (.env.local ou ambiente).");
  const dominio = normalizarDominio(process.env.ALLOWED_EMAIL_DOMAIN);
  const { endpoint, init } = montarRequisicao({ url, chave, dominio });
  const r = await fetch(endpoint, init);
  if (!r.ok) throw new Error(`O Supabase recusou a gravação (HTTP ${r.status}). A migration da tarefa 013 foi aplicada?`);
  console.log(dominio ? "Domínio permitido gravado (valor não exibido)." : "ALLOWED_EMAIL_DOMAIN vazio: cadastros novos ficam todos recusados.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  });
}
