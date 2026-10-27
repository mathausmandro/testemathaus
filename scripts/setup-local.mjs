// Gera .env.local a partir de `supabase status -o env` (Supabase local ligado).
//   node scripts/setup-local.mjs            cria .env.local (não sobrescreve sem --force)
//   node scripts/setup-local.mjs --force    sobrescreve
//   node scripts/setup-local.mjs --github-env   (CI) acrescenta SÓ as variáveis NEXT_PUBLIC_* a $GITHUB_ENV
// Nenhum valor é impresso. .env.local é ignorado pelo git e nunca é versionado.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Lê linhas CHAVE="valor" do `supabase status -o env`.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseStatusEnv(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return out;
}

/** Chave publicável: nome novo (PUBLISHABLE_KEY) ou antigo (ANON_KEY) da CLI. */
function pick(status, ...names) {
  for (const n of names) if (status[n]) return status[n];
  return undefined;
}

/**
 * Mapeia o status do Supabase local para as variáveis do app.
 * @returns {{ publicVars: Record<string,string>, serverVars: Record<string,string> }}
 */
export function mapStatus(status) {
  const url = pick(status, "API_URL");
  const publishable = pick(status, "PUBLISHABLE_KEY", "ANON_KEY");
  const secret = pick(status, "SECRET_KEY", "SERVICE_ROLE_KEY");
  if (!url || !publishable) {
    throw new Error("Saída do `supabase status` sem API_URL ou chave publicável. O Supabase local está rodando?");
  }
  const serverVars = secret ? { SUPABASE_SECRET_KEY: secret } : {};
  return {
    publicVars: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable },
    serverVars,
  };
}

export function buildEnvLocal(mapped) {
  const lines = [
    "# Gerado por scripts/setup-local.mjs. Só valores do Supabase LOCAL. Não versionar.",
    ...Object.entries(mapped.publicVars).map(([k, v]) => `${k}=${v}`),
    ...Object.entries(mapped.serverVars).map(([k, v]) => `${k}=${v}`),
    "# Pendente: domínio de e-mail da empresa (definir manualmente).",
    "ALLOWED_EMAIL_DOMAIN=",
    "",
  ];
  return lines.join("\n");
}

function readStatus() {
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "npx.cmd" : "npx", ["supabase", "status", "-o", "env"], { encoding: "utf8", shell: isWin });
  if (r.status !== 0) throw new Error("`supabase status` falhou. Rode `npx supabase start` (requer Docker) e tente de novo.");
  return parseStatusEnv(r.stdout);
}

function main(argv) {
  const mapped = mapStatus(readStatus());
  if (argv.includes("--github-env")) {
    const file = process.env.GITHUB_ENV;
    if (!file) throw new Error("GITHUB_ENV não definido.");
    appendFileSync(file, Object.entries(mapped.publicVars).map(([k, v]) => `${k}=${v}\n`).join(""));
    console.log("NEXT_PUBLIC_* do Supabase local exportadas para o job.");
    return;
  }
  if (existsSync(".env.local") && !argv.includes("--force")) {
    throw new Error(".env.local já existe. Use --force para sobrescrever.");
  }
  writeFileSync(".env.local", buildEnvLocal(mapped), { mode: 0o600 });
  console.log(".env.local criado (valores não exibidos).");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  }
}
