import { describe, expect, it } from "vitest";
import { STEPS, runSteps } from "../../scripts/verify.mjs";

type Step = { id: string };
const quiet = () => {};
const run = (opts: Record<string, unknown>) => runSteps(STEPS, { log: quiet, ...opts });

describe("verify: ordem das etapas", () => {
  it("segue a ordem oficial", () => {
    expect(STEPS.map((s) => s.id)).toEqual(["secrets", "audit", "lint", "typecheck", "test", "pgtap", "build", "e2e", "perf"]);
  });

  it("executa na ordem e sai com 0 quando tudo passa", () => {
    const calls: string[] = [];
    const { code, results } = run({
      exec: (s: Step) => (calls.push(s.id), 0),
      supabaseAvailable: () => true,
      env: {},
    });
    expect(code).toBe(0);
    expect(calls).toEqual(STEPS.map((s) => s.id));
    expect(results.every((r) => r.status === "PASSOU")).toBe(true);
  });
});

describe("verify: código de saída", () => {
  it("sai com 1 e não executa as seguintes quando uma etapa falha", () => {
    const calls: string[] = [];
    const { code, results } = run({
      exec: (s: Step) => (calls.push(s.id), s.id === "typecheck" ? 2 : 0),
      supabaseAvailable: () => true,
      env: {},
    });
    expect(code).toBe(1);
    expect(calls).toEqual(["secrets", "audit", "lint", "typecheck"]);
    expect(results.find((r) => r.id === "typecheck")?.status).toBe("FALHOU");
    expect(results.find((r) => r.id === "test")?.status).toBe("NÃO EXECUTADA");
  });
});

describe("verify: pgTAP sem Supabase local", () => {
  it("localmente é ignorada com aviso visível e não reprova", () => {
    const logs: string[] = [];
    const calls: string[] = [];
    const { code, results } = runSteps(STEPS, {
      log: (m: string) => logs.push(m),
      exec: (s: Step) => (calls.push(s.id), 0),
      supabaseAvailable: () => false,
      env: {},
    });
    expect(code).toBe(0);
    expect(results.find((r) => r.id === "pgtap")?.status).toBe("IGNORADA");
    expect(calls).not.toContain("pgtap");
    expect(calls).toContain("perf");
    expect(logs.join("\n")).toContain("ignorada: Supabase local ausente");
  });

  it("no CI a ausência falha e interrompe o restante", () => {
    const calls: string[] = [];
    const { code, results } = run({
      exec: (s: Step) => (calls.push(s.id), 0),
      supabaseAvailable: () => false,
      env: { CI: "true" },
    });
    expect(code).toBe(1);
    expect(results.find((r) => r.id === "pgtap")?.status).toBe("FALHOU");
    expect(calls).toEqual(["secrets", "audit", "lint", "typecheck", "test"]);
  });

  it("com Supabase presente roda o pgTAP e propaga a falha", () => {
    const { code, results } = run({
      exec: (s: Step) => (s.id === "pgtap" ? 1 : 0),
      supabaseAvailable: () => true,
      env: { CI: "true" },
    });
    expect(code).toBe(1);
    expect(results.find((r) => r.id === "pgtap")?.status).toBe("FALHOU");
  });
});
