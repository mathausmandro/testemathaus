// Valores FICTÍCIOS e NÃO SECRETOS para os processos de teste que sobem o app sem Supabase:
// build do verify, e2e (Playwright) e Lighthouse. O app valida as variáveis na inicialização
// (src/instrumentation.ts) e no build (next.config.ts); sem isto esses testes não subiriam.
//
// Regras:
// - Só preenche o que FALTA: variável já definida no ambiente ou em um arquivo .env que o Next
//   carrega (.env.production.local, .env.local, .env.production, .env) nunca é sobrescrita.
//   Assim o e2e com Supabase local (E2E_SUPABASE=true e .env.local) continua usando os valores reais.
// - Nada disto vai para arquivo .env versionado nem para a imagem Docker.
// - Os valores apontam para o loopback e não abrem nenhum projeto: não são chaves de verdade.
//
// Uso como comando: node scripts/com-env-ficticia.mjs <comando> [args...]
// Este módulo não usa import.meta: o Playwright o carrega a partir do playwright.config.ts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ENV_FICTICIA = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ficticia-chave-publicavel-somente-testes",
  SUPABASE_SECRET_KEY: "ficticia-nao-e-segredo-somente-testes",
});

/** Arquivos .env que `next build` e `next start` carregam (modo produção), em ordem de prioridade. */
export const ARQUIVOS_ENV_DO_NEXT = [".env.production.local", ".env.local", ".env.production", ".env"];

/**
 * Nomes com valor não vazio em um texto no formato .env.
 * @param {string} texto
 * @returns {Set<string>}
 */
export function nomesDefinidos(texto) {
  const nomes = new Set();
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const valor = m[2].trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    if (valor !== "" && !valor.startsWith("#")) nomes.add(m[1]);
  }
  return nomes;
}

/**
 * Nomes definidos nos arquivos .env do diretório.
 * @param {string} dir
 * @param {(p: string) => string | null} [ler]
 */
export function nomesNosArquivosEnv(dir, ler = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null)) {
  const nomes = new Set();
  for (const arq of ARQUIVOS_ENV_DO_NEXT) {
    const texto = ler(join(dir, arq));
    if (texto) for (const n of nomesDefinidos(texto)) nomes.add(n);
  }
  return nomes;
}

/**
 * Devolve só as variáveis fictícias que faltam (não estão no ambiente nem nos arquivos .env).
 * @param {Record<string, string | undefined>} env
 * @param {Set<string>} nomesEmArquivo
 * @returns {Record<string, string>}
 */
export function faltantesFicticias(env, nomesEmArquivo) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [nome, valor] of Object.entries(ENV_FICTICIA)) {
    const noAmbiente = typeof env[nome] === "string" && env[nome].trim() !== "";
    if (!noAmbiente && !nomesEmArquivo.has(nome)) out[nome] = valor;
  }
  return out;
}

/**
 * Ambiente para um processo de teste: o atual mais as fictícias que faltam.
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [dir]
 */
export function comEnvFicticia(env = process.env, dir = process.cwd()) {
  return { ...env, ...faltantesFicticias(env, nomesNosArquivosEnv(dir)) };
}
