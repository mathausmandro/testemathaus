// @vitest-environment node
// QA A1 (tarefa 004): o app falha na inicialização sem variável obrigatória; os testes sem Supabase
// recebem valores fictícios só do que falta.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvError } from "@/lib/env";
import { PREFIXO_DA_FALHA, validarAmbienteNaInicializacao } from "@/lib/env-startup";
import { validarAmbienteDoBuild } from "../../next.config";
import {
  ENV_FICTICIA,
  comEnvFicticia,
  faltantesFicticias,
  nomesDefinidos,
  nomesNosArquivosEnv,
} from "../../scripts/env-ficticia.mjs";
import { STEPS, ambienteDaEtapa } from "../../scripts/verify.mjs";

const raiz = join(__dirname, "..", "..");
const completo = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave-publicavel-de-teste",
  SUPABASE_SECRET_KEY: "valor-de-teste",
};

afterEach(() => vi.unstubAllEnvs());

describe("validarAmbienteNaInicializacao (src/instrumentation.ts)", () => {
  it("instrumentation.ts chama a validação em register", () => {
    const fonte = readFileSync(join(raiz, "src", "instrumentation.ts"), "utf8");
    expect(fonte).toMatch(/export async function register\(\)/);
    expect(fonte).toMatch(/validarAmbienteNaInicializacao\(process\.env\.NEXT_RUNTIME\)/);
  });

  it("com tudo definido: segue sem encerrar", async () => {
    for (const [k, v] of Object.entries(completo)) vi.stubEnv(k, v);
    const encerrar = vi.fn();
    await expect(validarAmbienteNaInicializacao("nodejs", { encerrar, registrar: vi.fn() })).resolves.toBeUndefined();
    expect(encerrar).not.toHaveBeenCalled();
  });

  it("sem variável pública: encerra com código 1 e mensagem em pt-BR só com nomes", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "valor-que-nao-pode-aparecer");
    const encerrar = vi.fn();
    const registrar = vi.fn();
    await expect(validarAmbienteNaInicializacao("nodejs", { encerrar, registrar })).rejects.toBeInstanceOf(EnvError);
    expect(encerrar).toHaveBeenCalledWith(1);
    const msg = registrar.mock.calls[0][0] as string;
    expect(msg.startsWith(PREFIXO_DA_FALHA)).toBe(true);
    expect(msg).toContain("NEXT_PUBLIC_SUPABASE_URL não pode ser vazia");
    expect(msg).not.toContain("valor-que-nao-pode-aparecer");
  });

  it("sem SUPABASE_SECRET_KEY: falha no runtime nodejs e não imprime valores", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", completo.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", completo.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const encerrar = vi.fn();
    const registrar = vi.fn();
    await expect(validarAmbienteNaInicializacao("nodejs", { encerrar, registrar })).rejects.toThrow(/SUPABASE_SECRET_KEY/);
    expect(encerrar).toHaveBeenCalledWith(1);
    expect(registrar.mock.calls[0][0]).not.toContain(completo.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  });

  it("no edge valida só as públicas e relança (sem process.exit)", async () => {
    const validarServidor = vi.fn();
    const encerrar = vi.fn();
    await validarAmbienteNaInicializacao("edge", { validarPublico: () => undefined, validarServidor, encerrar });
    expect(validarServidor).not.toHaveBeenCalled();
    await expect(
      validarAmbienteNaInicializacao("edge", {
        validarPublico: () => {
          throw new EnvError(["X não definida"]);
        },
        encerrar,
        registrar: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(EnvError);
    expect(encerrar).not.toHaveBeenCalled();
  });

  it("erro que não é de ambiente é relançado sem encerrar", async () => {
    const encerrar = vi.fn();
    const boom = new Error("outro");
    await expect(
      validarAmbienteNaInicializacao("nodejs", { validarPublico: () => { throw boom; }, encerrar }),
    ).rejects.toBe(boom);
    expect(encerrar).not.toHaveBeenCalled();
  });
});

describe("validarAmbienteDoBuild (next.config.ts)", () => {
  it("no build de produção, falta de NEXT_PUBLIC_* interrompe com mensagem clara", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => validarAmbienteDoBuild("phase-production-build")).toThrow(/Build interrompido.*NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("fora do build (dev, start, testes) não valida aqui", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => validarAmbienteDoBuild("phase-development-server")).not.toThrow();
    expect(() => validarAmbienteDoBuild("phase-production-server")).not.toThrow();
  });
});

describe("scripts/env-ficticia.mjs", () => {
  it("valores são fictícios, locais e marcados como tal", () => {
    expect(ENV_FICTICIA.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    for (const v of Object.values(ENV_FICTICIA)) expect(v).toMatch(/ficticia|127\.0\.0\.1/);
  });

  it("lê só nomes com valor dos arquivos .env", () => {
    const nomes = nomesDefinidos("# c\nA=1\nB=\nexport C=\"x\"\nD=''\nE= # comentário\n");
    expect([...nomes].sort()).toEqual(["A", "C"]);
  });

  it("preenche só o que falta; nunca sobrescreve ambiente nem .env.local", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: "http://real.local:1" };
    const doArquivo = new Set(["SUPABASE_SECRET_KEY"]);
    expect(faltantesFicticias(env, doArquivo)).toEqual({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ENV_FICTICIA.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
    expect(faltantesFicticias({ ...completo }, new Set())).toEqual({});
    expect(faltantesFicticias({ NEXT_PUBLIC_SUPABASE_URL: "  " }, new Set())).toHaveProperty("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("procura nos arquivos que o Next carrega em produção", () => {
    const lidos: string[] = [];
    const nomes = nomesNosArquivosEnv("/x", (p: string) => {
      lidos.push(p.replace(/\\/g, "/"));
      return p.endsWith(".env.local") ? "SUPABASE_SECRET_KEY=abc\n" : null;
    });
    expect(lidos.map((p) => p.split("/").pop())).toEqual([".env.production.local", ".env.local", ".env.production", ".env"]);
    expect(nomes.has("SUPABASE_SECRET_KEY")).toBe(true);
  });

  it("comEnvFicticia mantém o restante do ambiente", () => {
    const r = comEnvFicticia({ OUTRA: "1" }, join(raiz, "tests", "stubs"));
    expect(r.OUTRA).toBe("1");
    expect(r.NEXT_PUBLIC_SUPABASE_URL).toBe(ENV_FICTICIA.NEXT_PUBLIC_SUPABASE_URL);
  });

  it("nenhum .env versionado recebe os valores fictícios", () => {
    const exemplo = readFileSync(join(raiz, ".env.example"), "utf8");
    for (const v of Object.values(ENV_FICTICIA)) expect(exemplo).not.toContain(v);
  });
});

describe("onde os valores fictícios entram", () => {
  it("verify: só build, e2e e Lighthouse", () => {
    expect(STEPS.filter((s: { envFicticia?: boolean }) => s.envFicticia).map((s: { id: string }) => s.id)).toEqual(["build", "e2e", "perf"]);
    const unit = STEPS.find((s: { id: string }) => s.id === "test")!;
    expect(ambienteDaEtapa(unit, { A: "1" })).toEqual({ A: "1" });
    const build = STEPS.find((s: { id: string }) => s.id === "build")!;
    expect(ambienteDaEtapa(build, { A: "1" }, join(raiz, "tests", "stubs")).NEXT_PUBLIC_SUPABASE_URL).toBe(ENV_FICTICIA.NEXT_PUBLIC_SUPABASE_URL);
  });

  it("Playwright, Lighthouse e test:e2e usam o helper", () => {
    expect(readFileSync(join(raiz, "playwright.config.ts"), "utf8")).toMatch(/env: faltantesFicticias\(/);
    expect(readFileSync(join(raiz, "tests", "perf", "run-lighthouse.mjs"), "utf8")).toMatch(/comEnvFicticia\(\)/);
    const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
    expect(pkg.scripts["test:e2e"]).toBe("node scripts/com-env-ficticia.mjs npm run build && playwright test");
  });
});
