// Aplica migrations em projeto Supabase REMOTO (teste ou produção) com guardas. Tarefa 018.
//   node scripts/db-remoto.mjs link teste        vincula a pasta ao projeto de teste
//   node scripts/db-remoto.mjs push teste        aplica migrations pendentes (supabase db push)
//   node scripts/db-remoto.mjs push producao --confirmo=producao
// Variáveis (ambiente do shell ou do GitHub; nunca no repositório):
//   SUPABASE_PROJECT_REF_TESTE, SUPABASE_PROJECT_REF_PRODUCAO, SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD.
// Recusa reset e qualquer comando destrutivo. Nenhum valor é impresso.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
 */
export function avaliarPedido(argv, env) {
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
  const args = comando === "link" ? ["link", "--project-ref", ref] : ["db", "push", ...resto.filter((a) => a === "--dry-run")];
  return { ok: true, args };
}

function main(argv) {
  const r = avaliarPedido(argv, process.env);
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
