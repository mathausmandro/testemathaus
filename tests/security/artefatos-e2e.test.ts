// @vitest-environment node
// G2 (docs/seguranca/002.md): artefatos do Playwright publicados no CI não podem conter sessão.
// Confere: sem trace no CI, storageState fora das pastas enviadas e no .gitignore, limpeza antes do upload.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const wf = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
const steps: { name?: string; run?: string; uses?: string; if?: string; with?: { path?: string } }[] = wf.jobs.quality.steps;
const upload = steps.findIndex((s) => String(s.uses).startsWith("actions/upload-artifact"));
const enviados = String(steps[upload]?.with?.path ?? "")
  .split(/\s+/)
  .filter(Boolean)
  .map((p) => p.replace(/\/$/, ""));

describe("artefatos do e2e sem sessão (G2)", () => {
  it("no CI o Playwright não grava trace, vídeo nem captura", async () => {
    const antes = process.env.CI;
    process.env.CI = "true";
    try {
      vi.resetModules();
      const { default: cfg } = await import("../../playwright.config");
      expect(cfg.use?.trace).toBe("off");
      expect(cfg.use?.video).toBe("off");
      expect(cfg.use?.screenshot).toBe("off");
      for (const p of cfg.projects ?? []) expect(p.use?.trace ?? "off", p.name).toBe("off");
    } finally {
      if (antes === undefined) delete process.env.CI;
      else process.env.CI = antes;
    }
  });

  it("storageState fica fora das pastas enviadas e no .gitignore", async () => {
    const { STORAGE_STATE_DIR } = await import("../../playwright.config");
    for (const p of enviados) expect(STORAGE_STATE_DIR.startsWith(p), p).toBe(false);
    expect(readFileSync(".gitignore", "utf8")).toMatch(new RegExp(`^/?${STORAGE_STATE_DIR.replace(/[./]/g, "\\$&")}/?$`, "m"));
  });

  it("nenhum teste e2e grava storageState dentro das pastas enviadas", () => {
    for (const f of readdirSync("tests/e2e")) {
      const t = readFileSync(`tests/e2e/${f}`, "utf8");
      for (const m of t.matchAll(/storageState\s*\(\s*\{\s*path:\s*["'`]([^"'`]+)/g)) {
        for (const p of enviados) expect(m[1].replace(/^\.\//, "").startsWith(p), `${f}: ${m[1]}`).toBe(false);
      }
    }
  });

  it("o CI apaga traces, HAR e storageState das pastas antes de publicar, mesmo com falha", () => {
    const limpeza = steps.findIndex((s) => /Remover sessão dos artefatos/.test(String(s.name)));
    expect(limpeza).toBeGreaterThan(-1);
    expect(limpeza).toBeLessThan(upload);
    const s = steps[limpeza];
    expect(s.if).toBe("always()");
    for (const trecho of ["playwright-report", "test-results", "'*.zip'", "'*.har'", "storage*state", "-delete"]) {
      expect(s.run, trecho).toContain(trecho);
    }
  });
});
