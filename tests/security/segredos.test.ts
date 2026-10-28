// @vitest-environment node
// Tarefa 017: segredos fora do repositório e fora do bundle do cliente.
// - Repositório: varre os arquivos versionados (git ls-files) atrás de chaves do Supabase, JWT de
//   service_role, chaves privadas e atribuição de valor a SUPABASE_SECRET_KEY. Complementa o secretlint
//   (árvore) e o gitleaks (histórico), que rodam no mesmo npm run test:security.
// - Bundle: varre o JavaScript que vai ao navegador (.next/static). Sem build é pulado, exceto quando
//   SECURITY_EXIGE_BUILD=1 (npm run test:security e verify), aí reprova.
// - .env* fora do git.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

/** Padrões de segredo. Cada um com um exemplo falso no teste do detector. */
export const PADROES: { nome: string; re: RegExp }[] = [
  { nome: "chave secreta do Supabase", re: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  { nome: "JWT de service_role", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/ },
  { nome: "chave privada", re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  // Estilo arquivo .env / shell (início de linha). Código que lê process.env não casa.
  { nome: "valor atribuído a SUPABASE_SECRET_KEY", re: /^\s*(?:export\s+)?SUPABASE_SECRET_KEY\s*=\s*["']?[^\s"']{16,}/m },
];

export function achados(texto: string): string[] {
  return PADROES.filter((p) => p.re.test(texto)).map((p) => p.nome);
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const BINARIO = /\.(png|jpe?g|gif|webp|ico|woff2?|docx|pdf|zip)$/i;
// Este arquivo contém os padrões e exemplos falsos montados em tempo de execução, não segredos.
const ESTE_ARQUIVO = "tests/security/segredos.test.ts";

describe("segredos no repositório", () => {
  const versionados = git(["ls-files", "-z"]).split("\0").filter(Boolean);

  it("lista os arquivos versionados", () => {
    expect(versionados).toContain("package.json");
  });

  it("nenhum arquivo versionado contém segredo", () => {
    const encontrados: string[] = [];
    for (const f of versionados) {
      if (BINARIO.test(f) || f === ESTE_ARQUIVO || !existsSync(join(RAIZ, f))) continue;
      const texto = readFileSync(join(RAIZ, f), "utf8");
      for (const nome of achados(texto)) encontrados.push(`${f}: ${nome}`);
    }
    expect(encontrados).toEqual([]);
  });

  it(".env* fica fora do git (só .env.example é versionado)", () => {
    const gi = readFileSync(join(RAIZ, ".gitignore"), "utf8").split(/\r?\n/);
    expect(gi).toContain(".env*");
    expect(gi).toContain("!.env.example");
    for (const f of [".env", ".env.local", ".env.production", ".env.test.local", "supabase/.env"]) {
      expect(() => git(["check-ignore", "-q", f]), f).not.toThrow();
    }
    expect(versionados.filter((f) => /(^|\/)\.env/.test(f))).toEqual([".env.example"]);
  });

  it("detector: reconhece cada padrão (valores falsos montados aqui)", () => {
    const falso = "x".repeat(20);
    expect(achados(`sb_${"secret"}_${falso}`)).toEqual(["chave secreta do Supabase"]);
    const payload = Buffer.from('{"role":"service_role"}').toString("base64url");
    expect(achados(`eyJhbGciOiJIUzI1NiJ9.${payload}.assinatura`)).toEqual(["JWT de service_role"]);
    expect(achados(`-----BEGIN ${"PRIVATE"} KEY-----`)).toEqual(["chave privada"]);
    expect(achados(`SUPABASE_SECRET_KEY=${falso}`)).toEqual(["valor atribuído a SUPABASE_SECRET_KEY"]);
    expect(achados("SUPABASE_SECRET_KEY=")).toEqual([]);
    expect(achados("process.env.SUPABASE_SECRET_KEY")).toEqual([]);
    expect(achados("  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,")).toEqual([]);
  });
});

function arquivosJs(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosJs(p, acc);
    else if (/\.(js|mjs|json|map)$/.test(nome)) acc.push(p);
  }
  return acc;
}

describe("segredos no bundle do cliente (.next/static)", () => {
  const estatico = join(RAIZ, ".next", "static");
  const temBuild = existsSync(join(RAIZ, ".next", "BUILD_ID")) && existsSync(estatico);
  const exige = process.env.SECURITY_EXIGE_BUILD === "1";

  it.runIf(exige)("o build existe (exigido pelo npm run test:security)", () => {
    expect(temBuild).toBe(true);
  });

  it.runIf(temBuild)("nenhum arquivo do navegador cita a chave secreta, o cliente admin ou segredo conhecido", () => {
    const valorReal = process.env.SUPABASE_SECRET_KEY;
    const encontrados: string[] = [];
    const arquivos = arquivosJs(estatico);
    expect(arquivos.length).toBeGreaterThan(0);
    for (const f of arquivos) {
      const texto = readFileSync(f, "utf8");
      const rel = f.slice(RAIZ.length + 1);
      if (/SUPABASE_SECRET_KEY|ALLOWED_EMAIL_DOMAIN|createAdminSupabase|service_role/.test(texto)) encontrados.push(`${rel}: nome sensível`);
      for (const nome of achados(texto)) encontrados.push(`${rel}: ${nome}`);
      if (valorReal && valorReal.length >= 8 && texto.includes(valorReal)) encontrados.push(`${rel}: valor de SUPABASE_SECRET_KEY`);
    }
    expect(encontrados).toEqual([]);
  });
});
