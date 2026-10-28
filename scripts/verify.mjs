// Pipeline local de qualidade: npm run verify.
// Etapas em ordem fixa; cada uma mostra PASSOU, FALHOU ou IGNORADA; saída != 0 se alguma falhar.
// O executor é injetável para testar a ordem e o código de saída sem rodar as etapas de verdade.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { comEnvFicticia } from "./env-ficticia.mjs";

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const npx = isWin ? "npx.cmd" : "npx";

/** Ordem oficial das etapas (docs/qualidade.md). */
export const STEPS = [
  { id: "secrets", name: "Varredura de segredos (secretlint)", cmd: npx, args: ["secretlint", "**/*"] },
  { id: "audit", name: "npm audit (alta ou crítica)", cmd: npm, args: ["audit", "--audit-level=high"] },
  { id: "lint", name: "Lint", cmd: npm, args: ["run", "lint"] },
  { id: "typecheck", name: "Tipos", cmd: npm, args: ["run", "typecheck"] },
  { id: "test", name: "Testes unitários", cmd: npm, args: ["test"] },
  // pgTAP: obrigatória no CI (CI=true); localmente só é ignorada, com aviso, se o Supabase local faltar.
  { id: "pgtap", name: "pgTAP (supabase test db)", cmd: npx, args: ["supabase", "test", "db"], needsSupabase: true },
  // build, e2e e Lighthouse sobem o app sem Supabase: recebem valores fictícios só do que faltar
  // (scripts/env-ficticia.mjs). O app valida as variáveis no build e na inicialização.
  { id: "build", name: "Build", cmd: npm, args: ["run", "build"], envFicticia: true },
  // Depois do build: varre o bundle do cliente, cabeçalhos, rotas e validação (tarefa 017).
  { id: "security", name: "Segurança (npm run test:security)", cmd: npm, args: ["run", "test:security"] },
  { id: "e2e", name: "Testes e2e (Playwright)", cmd: npx, args: ["playwright", "test"], envFicticia: true },
  { id: "perf", name: "Performance (Lighthouse CI)", cmd: "node", args: ["tests/perf/run-lighthouse.mjs", "--skip-build"], envFicticia: true },
];

/** @param {Record<string, string | undefined>} [env] */
export function isCI(env = process.env) {
  return env.CI === "true" || env.CI === "1";
}

/**
 * Ambiente do processo da etapa: com valores fictícios (só os que faltam) quando a etapa pede.
 * @param {{ envFicticia?: boolean }} step
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [dir]
 */
export function ambienteDaEtapa(step, env = process.env, dir = process.cwd()) {
  return step.envFicticia ? comEnvFicticia(env, dir) : env;
}

/** Executor real: herda stdio e devolve o código de saída. */
export function realExec(step) {
  const r = spawnSync(step.cmd, step.args, { stdio: "inherit", shell: isWin, env: ambienteDaEtapa(step) });
  return r.status ?? 1;
}

/** Configuração versionada do Supabase local (criada na tarefa 004). */
export function realConfigExists() {
  return existsSync("supabase/config.toml");
}

/** Supabase local disponível? `supabase status` só passa com a pilha local em execução. */
export function realSupabaseAvailable() {
  const r = spawnSync(npx, ["supabase", "status"], { stdio: "ignore", shell: isWin });
  return r.status === 0;
}

/**
 * Roda as etapas em ordem; para na primeira falha (etapas seguintes ficam "NÃO EXECUTADA").
 * @param {any[]} steps
 * @param {{ exec?: (s: any) => number, configExists?: () => boolean, supabaseAvailable?: () => boolean, env?: Record<string, string | undefined>, log?: (m: string) => void, now?: () => number }} [deps]
 * @returns {{ code: number, results: { id: string, name: string, status: string, ms: number, note?: string }[] }}
 */
export function runSteps(
  steps,
  { exec = realExec, configExists = realConfigExists, supabaseAvailable = realSupabaseAvailable, env = process.env, log = console.log, now = Date.now } = {},
) {
  const results = [];
  let failed = false;
  for (const step of steps) {
    if (failed) {
      results.push({ id: step.id, name: step.name, status: "NÃO EXECUTADA", ms: 0 });
      continue;
    }
    log(`\n=== ${step.name} ===`);
    const t0 = now();
    let status;
    let note;
    // Sem config.toml não há o que consultar. Com config.toml mas sem a pilha rodando (sem Docker),
    // localmente a etapa é ignorada com aviso; no CI (CI=true) reprova.
    const semConfig = step.needsSupabase && !configExists();
    if (step.needsSupabase && (semConfig || !supabaseAvailable())) {
      if (isCI(env)) {
        status = "FALHOU";
        note = semConfig
          ? "supabase/config.toml ausente; no CI o pgTAP é obrigatório e não pode ser ignorado"
          : "Supabase local ausente; no CI o pgTAP é obrigatório e não pode ser ignorado";
        log(`FALHOU: ${note}`);
      } else {
        status = "IGNORADA";
        note = "ignorada: Supabase local ausente";
        log(`AVISO: ${note}. No CI esta etapa é obrigatória.`);
      }
    } else {
      status = exec(step) === 0 ? "PASSOU" : "FALHOU";
    }
    if (status === "FALHOU") failed = true;
    results.push({ id: step.id, name: step.name, status, ms: now() - t0, note });
  }
  log("\n=== Resumo ===");
  for (const r of results) {
    log(`${r.status.padEnd(14)} ${r.name}${r.ms ? ` (${(r.ms / 1000).toFixed(1)} s)` : ""}${r.note ? ` - ${r.note}` : ""}`);
  }
  const code = failed ? 1 : 0;
  log(code === 0 ? "\nverify: OK" : "\nverify: FALHOU");
  return { code, results };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = Date.now();
  const { code } = runSteps(STEPS);
  console.log(`Tempo total: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(code);
}
