// Aplica migrations em projeto Supabase REMOTO (teste ou produção) com guardas. Tarefa 018.
//   node scripts/db-remoto.mjs link teste        vincula a pasta ao projeto de teste
//   node scripts/db-remoto.mjs push teste        aplica migrations pendentes (supabase db push)
//   node scripts/db-remoto.mjs push producao --confirmo=producao
// Variáveis (ambiente do shell ou do GitHub; nunca no repositório):
//   SUPABASE_PROJECT_REF_TESTE, SUPABASE_PROJECT_REF_PRODUCAO, SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD.
// Recusa reset e qualquer comando destrutivo. Nenhum valor é impresso.
// push só roda se a pasta estiver vinculada (supabase/.temp/project-ref) ao projeto do ambiente
// pedido (achado M2, docs/seguranca/003-019.md): a CLI aplica no último projeto vinculado.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Arquivo em que a CLI do Supabase grava o projeto vinculado pelo último `supabase link`. */
export const ARQUIVO_DO_VINCULO = join("supabase", ".temp", "project-ref");

/**
 * Ref do projeto vinculado nesta pasta, ou null.
 * @param {string} [dir]
 * @param {(p: string) => string | null} [ler]
 */
export function lerRefVinculado(dir = process.cwd(), ler = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null)) {
  const texto = ler(join(dir, ARQUIVO_DO_VINCULO));
  const ref = (texto ?? "").trim();
  return ref === "" ? null : ref;
}

export const COMANDOS_PERMITIDOS = ["link", "push"];
export const AMBIENTES = ["teste", "producao"];
const DESTRUTIVOS = ["reset", "drop", "truncate", "delete"];

/** True só para loopback (Supabase local). */
export function ehUrlLocal(url) {
  try {
    const h = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "host.docker.internal";
  } catch {
    return false;
  }
}

/**
 * Decide se `supabase db reset` pode rodar contra a URL. Só URL local passa.
 * @param {string | undefined} url
 */
export function podeResetar(url) {
  return typeof url === "string" && url !== "" && ehUrlLocal(url);
}

/**
 * Valida o pedido de comando remoto. Devolve { ok, motivo?, args? }.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {{ refVinculado?: string | null }} [vinculo] projeto vinculado na pasta (push exige igual ao do ambiente)
 */
export function avaliarPedido(argv, env, { refVinculado = null } = {}) {
  const [comando, ambiente, ...resto] = argv;
  if (!comando || [comando, ...resto].some((a) => DESTRUTIVOS.some((d) => a.includes(d)))) {
    return { ok: false, motivo: "Comando destrutivo ou ausente. Só link e push são permitidos em projeto remoto." };
  }
  if (!COMANDOS_PERMITIDOS.includes(comando)) return { ok: false, motivo: `Comando não permitido: ${comando}.` };
  if (!AMBIENTES.includes(ambiente)) return { ok: false, motivo: "Informe o ambiente: teste ou producao." };
  if (resto.some((a) => a !== "--confirmo=producao" && a !== "--dry-run")) {
    return { ok: false, motivo: "Opção não permitida." };
  }
  if (ambiente === "producao" && !resto.includes("--confirmo=producao")) {
    return { ok: false, motivo: "Produção exige --confirmo=producao." };
  }
  const chave = ambiente === "teste" ? "SUPABASE_PROJECT_REF_TESTE" : "SUPABASE_PROJECT_REF_PRODUCAO";
  const ref = env[chave];
  if (!ref) return { ok: false, motivo: `Defina ${chave} no ambiente.` };
  if (!/^[a-z0-9]{10,40}$/.test(ref)) return { ok: false, motivo: `${chave} com formato inválido.` };
  const outroRef = env[ambiente === "teste" ? "SUPABASE_PROJECT_REF_PRODUCAO" : "SUPABASE_PROJECT_REF_TESTE"];
  if (outroRef && outroRef === ref) return { ok: false, motivo: "Teste e produção apontam para o mesmo projeto." };
  if (!env.SUPABASE_ACCESS_TOKEN) return { ok: false, motivo: "Defina SUPABASE_ACCESS_TOKEN no ambiente." };
  if (comando === "push" && refVinculado !== ref) {
    // Não imprime nenhum ref: só diz o que fazer.
    return {
      ok: false,
      motivo: refVinculado
        ? `A pasta está vinculada a outro projeto, não ao de ${ambiente}. Rode npm run db:link:${ambiente} (com ${chave}) antes do push.`
        : `Nenhum projeto vinculado nesta pasta. Rode o link do ambiente ${ambiente} antes do push.`,
    };
  }
  const args = comando === "link" ? ["link", "--project-ref", ref] : ["db", "push", ...resto.filter((a) => a === "--dry-run")];
  return { ok: true, args };
}

function main(argv) {
  const r = avaliarPedido(argv, process.env, { refVinculado: lerRefVinculado() });
  if (!r.ok) throw new Error(r.motivo);
  const isWin = process.platform === "win32";
  const s = spawnSync(isWin ? "npx.cmd" : "npx", ["supabase", ...r.args], { stdio: "inherit", shell: isWin });
  process.exit(s.status ?? 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  }
}
