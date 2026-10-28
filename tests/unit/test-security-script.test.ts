// @vitest-environment node
// Tarefa 017: etapas do npm run test:security (scripts/test-security.mjs).
import { describe, expect, it, vi } from "vitest";
import { etapas, executar } from "../../scripts/test-security.mjs";

const ids = (l: { id: string }[]) => l.map((e) => e.id);

describe("test:security", () => {
  it("ordem: secretlint, audit, gitleaks, build (se faltar) e tests/security exigindo o build", () => {
    const l = etapas({ env: {}, gitleaks: "gitleaks", temBuild: false });
    expect(ids(l)).toEqual(["secretlint", "audit", "gitleaks", "build", "vitest"]);
    expect(l.at(-1)).toMatchObject({ args: ["vitest", "run", "tests/security"], env: { SECURITY_EXIGE_BUILD: "1" } });
    expect(l.find((e) => e.id === "audit")?.args).toEqual(["audit", "--audit-level=high"]);
    expect(l.find((e) => e.id === "gitleaks")?.args).toEqual(["git", "--config", ".gitleaks.toml", "--redact", "--no-banner", "."]);
  });

  it("com build pronto não refaz o build", () => {
    expect(ids(etapas({ env: {}, gitleaks: "gitleaks", temBuild: true }))).not.toContain("build");
  });

  it("sem gitleaks: ignora localmente e reprova no CI", () => {
    expect(etapas({ env: {}, gitleaks: null, temBuild: true }).find((e) => e.id === "gitleaks")).toHaveProperty("ignorar");
    const ci = etapas({ env: { CI: "true" }, gitleaks: null, temBuild: true });
    expect(ci.find((e) => e.id === "gitleaks")).toHaveProperty("falhar");
    expect(executar(ci, { rodar: vi.fn(() => ({ status: 0 })) as never, log: () => {} })).toBe(1);
  });

  it("para na primeira etapa que falha", () => {
    const chamadas: string[] = [];
    const rodar = vi.fn((cmd: string, args: string[]) => {
      chamadas.push(args[0]);
      return { status: args[0] === "audit" ? 1 : 0 };
    });
    const code = executar(etapas({ env: {}, gitleaks: "gitleaks", temBuild: true }), { rodar: rodar as never, log: () => {} });
    expect(code).toBe(1);
    expect(chamadas).toEqual(["secretlint", "audit"]);
  });

  it("tudo passando: saída 0", () => {
    const rodar = vi.fn(() => ({ status: 0 }));
    expect(executar(etapas({ env: {}, gitleaks: null, temBuild: true }), { rodar: rodar as never, log: () => {} })).toBe(0);
  });
});
