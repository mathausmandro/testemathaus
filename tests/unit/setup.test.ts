// @vitest-environment node
// QA A3 (tarefa 019): npm run setup encadeia doctor → setup:local → orientações, sem nada destrutivo.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ORIENTACOES, planejar, prerequisitos } from "../../scripts/setup.mjs";

const raiz = join(__dirname, "..", "..");
const fonte = readFileSync(join(raiz, "scripts", "setup.mjs"), "utf8");
const ok = (nome: string) => ({ nome, ok: true, detalhe: "" });
const falha = (nome: string) => ({ nome, ok: false, detalhe: "" });

describe("npm run setup", () => {
  it("existe no package.json e aponta para scripts/setup.mjs", () => {
    const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
    expect(pkg.scripts.setup).toBe("node scripts/setup.mjs");
  });

  it("o .env.local ausente não bloqueia (é o que o setup cria)", () => {
    const itens = [ok("Node.js"), ok("Docker"), falha(".env.local")];
    expect(prerequisitos(itens).map((i) => i.nome)).toEqual(["Node.js", "Docker"]);
    expect(planejar({ itens, envLocalExiste: false })).toEqual({ prosseguir: true, gerarEnvLocal: true, falhas: [] });
  });

  it("pré-requisito faltando: para antes do setup:local", () => {
    const p = planejar({ itens: [ok("Node.js"), falha("Docker")], envLocalExiste: false });
    expect(p).toEqual({ prosseguir: false, gerarEnvLocal: false, falhas: ["Docker"] });
  });

  it(".env.local existente não é sobrescrito", () => {
    expect(planejar({ itens: [ok("Node.js")], envLocalExiste: true }).gerarEnvLocal).toBe(false);
  });

  it("não executa comando destrutivo; só orienta", () => {
    expect(fonte).not.toMatch(/["']reset["']|--force["']|["']stop["']|rmSync|unlinkSync|writeFileSync/);
    expect(fonte).toMatch(/\["scripts\/setup-local\.mjs"\]/);
    const texto = ORIENTACOES.join("\n");
    expect(texto).toContain("npx supabase db reset");
    expect(texto).toContain("AUTH_LOCAL_PASSWORD_LOGIN=true");
  });
});
