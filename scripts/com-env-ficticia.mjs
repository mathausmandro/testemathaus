// Roda um comando com os valores FICTÍCIOS de teste que faltarem (scripts/env-ficticia.mjs).
//   node scripts/com-env-ficticia.mjs npm run build
// Só imprime os NOMES preenchidos, nunca valores.
import { spawnSync } from "node:child_process";
import { comEnvFicticia, faltantesFicticias, nomesNosArquivosEnv } from "./env-ficticia.mjs";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Uso: node scripts/com-env-ficticia.mjs <comando> [args...]");
  process.exit(2);
}
const preenchidas = Object.keys(faltantesFicticias(process.env, nomesNosArquivosEnv(process.cwd())));
if (preenchidas.length) console.log(`com-env-ficticia: valores fictícios de teste para ${preenchidas.join(", ")}`);
const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env: comEnvFicticia() });
process.exit(r.status ?? 1);
