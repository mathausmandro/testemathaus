// npm run test:security (tarefa 017): suíte de segurança completa.
// Etapas: secretlint (árvore) → npm audit (alta/crítica) → gitleaks (histórico git) → build (se faltar)
// → vitest tests/security (cabeçalhos, rotas, validação, segredos no bundle, use cache, artefatos do e2e).
// gitleaks: binário oficial fora do npm. Local sem o binário: etapa ignorada com aviso.
// No CI (CI=true) é obrigatório (o workflow coloca o binário verificado por checksum no PATH).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const npx = isWin ? "npx.cmd" : "npx";

/** @param {Record<string, string | undefined>} [env] */
export function isCI(env = process.env) {
  return env.CI === "true" || env.CI === "1";
}

/**
 * Caminho do gitleaks: GITLEAKS_BIN ou "gitleaks" no PATH; null se não houver.
 * @param {Record<string, string | undefined>} [env]
 */
export function acharGitleaks(env = process.env, rodar = spawnSync) {
  const candidato = env.GITLEAKS_BIN || "gitleaks";
  const r = rodar(candidato, ["version"], { stdio: "ignore" });
  return r.status === 0 ? candidato : null;
}

/**
 * @param {{ env?: Record<string, string | undefined>, gitleaks?: string | null, temBuild?: boolean }} [opcoes]
 * @returns {{ id: string, nome: string, cmd?: string, args?: string[], env?: Record<string,string>, ignorar?: string, falhar?: string }[]}
 */
export function etapas({ env = process.env, gitleaks = acharGitleaks(env), temBuild = existsSync(".next/BUILD_ID") } = {}) {
  const lista = [
    { id: "secretlint", nome: "Segredos na árvore (secretlint)", cmd: npx, args: ["secretlint", "**/*"] },
    { id: "audit", nome: "Dependências (npm audit alta/crítica)", cmd: npm, args: ["audit", "--audit-level=high"] },
  ];
  if (gitleaks) {
    lista.push({
      id: "gitleaks",
      nome: "Segredos no histórico (gitleaks git)",
      cmd: gitleaks,
      args: ["git", "--config", ".gitleaks.toml", "--redact", "--no-banner", "."],
    });
  } else if (isCI(env)) {
    lista.push({ id: "gitleaks", nome: "Segredos no histórico (gitleaks git)", falhar: "gitleaks ausente; no CI é obrigatório" });
  } else {
    lista.push({ id: "gitleaks", nome: "Segredos no histórico (gitleaks git)", ignorar: "gitleaks não instalado nesta máquina (roda no CI)" });
  }
  if (!temBuild) lista.push({ id: "build", nome: "Build (necessário para varrer o bundle do cliente)", cmd: npm, args: ["run", "build"] });
  lista.push({
    id: "vitest",
    nome: "Testes de segurança (tests/security)",
    cmd: npx,
    args: ["vitest", "run", "tests/security"],
    // Com a variável, o teste do bundle reprova se não houver build (em vez de ser pulado).
    env: { SECURITY_EXIGE_BUILD: "1" },
  });
  return lista;
}

/**
 * @param {ReturnType<typeof etapas>} lista
 * @param {{ rodar?: (cmd: string, args: string[], opts: object) => { status: number | null }, log?: (m: string) => void }} [deps]
 */
export function executar(lista, { rodar = spawnSync, log = console.log } = {}) {
  for (const e of lista) {
    log(`\n=== ${e.nome} ===`);
    if (e.ignorar) {
      log(`IGNORADA: ${e.ignorar}`);
      continue;
    }
    if (e.falhar) {
      log(`FALHOU: ${e.falhar}`);
      return 1;
    }
    const r = rodar(e.cmd, e.args, { stdio: "inherit", shell: isWin, env: { ...process.env, ...(e.env ?? {}) } });
    if ((r.status ?? 1) !== 0) {
      log(`FALHOU: ${e.nome}`);
      return r.status ?? 1;
    }
  }
  log("\ntest:security: OK");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(executar(etapas()));
}
