import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const raw = readFileSync(".github/workflows/ci.yml", "utf8");
const wf = parse(raw);
const job = wf.jobs.quality;
const steps: Record<string, unknown>[] = job.steps;

describe("workflow de CI", () => {
  it("tem estrutura válida", () => {
    expect(wf.name).toBe("CI");
    expect(wf.on).toBeTruthy();
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(steps.length).toBeGreaterThan(3);
    for (const s of steps) expect(Boolean(s.run) !== Boolean(s.uses), JSON.stringify(s)).toBe(true);
  });

  it("usa permissions mínimas", () => {
    expect(wf.permissions).toEqual({ contents: "read" });
  });

  it("fixa todas as actions por SHA de commit", () => {
    const uses = steps.map((s) => s.uses).filter(Boolean) as string[];
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  it("roda gitleaks com checksum e o verify com CI=true", () => {
    expect(raw).toMatch(/sha256sum -c/);
    expect(raw).toMatch(/gitleaks[^\n]* git /);
    expect(wf.env.CI).toBe("true");
    expect(steps.some((s) => s.run === "npm run verify")).toBe(true);
  });

  it("publica relatórios mesmo com falha", () => {
    const up = steps.find((s) => String(s.uses).startsWith("actions/upload-artifact"));
    expect(up?.if).toBe("always()");
    const path = String((up?.with as { path: string }).path);
    expect(path).toContain("playwright-report/");
    expect(path).toContain(".lighthouseci/");
    expect(path).toContain("test-results/");
  });

  it("envia pasta oculta do Lighthouse e nenhum .env nos artefatos", () => {
    const up = steps.find((s) => String(s.uses).startsWith("actions/upload-artifact"));
    const w = up?.with as { path: string; "include-hidden-files"?: boolean };
    expect(w["include-hidden-files"]).toBe(true);
    const paths = String(w.path).split(/\s+/).filter(Boolean);
    for (const p of paths) {
      expect(p).not.toMatch(/\.env/);
      expect(p).not.toMatch(/^(\.|\*+\/?)$/);
    }
  });

  it("não usa secrets nem SUPABASE_SECRET_KEY", () => {
    expect(raw).not.toMatch(/secrets\./);
    expect(raw).not.toMatch(/SUPABASE_SECRET_KEY/);
  });
});

describe("workflow de CI: Supabase local", () => {
  const idx = (re: RegExp) => steps.findIndex((s) => re.test(String(s.name ?? "")));

  it("inicia o Supabase local sem condição e antes do verify", () => {
    const start = steps.find((s) => s.run === "npx supabase start");
    expect(start).toBeTruthy();
    expect(start?.if).toBeUndefined();
    expect(idx(/Iniciar Supabase/)).toBeLessThan(idx(/Verificar/));
  });

  it("exporta só NEXT_PUBLIC_* do status do Supabase, antes do verify", () => {
    const exp = steps.find((s) => s.run === "node scripts/setup-local.mjs --github-env");
    expect(exp).toBeTruthy();
    expect(idx(/Exportar variáveis públicas/)).toBeGreaterThan(idx(/Iniciar Supabase/));
    expect(idx(/Exportar variáveis públicas/)).toBeLessThan(idx(/Verificar/));
  });
});
