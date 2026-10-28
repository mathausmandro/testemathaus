import { describe, expect, it } from "vitest";
import { avaliarNode, diagnosticar, extrairVersao, formatar, variaveisAusentes } from "../../scripts/doctor.mjs";

describe("doctor", () => {
  it("extrai versões de textos de CLI", () => {
    expect(extrairVersao("v24.22.1")).toEqual([24, 22, 1]);
    expect(extrairVersao("Docker version 27.1.0, build abc")).toEqual([27, 1, 0]);
    expect(extrairVersao("lixo")).toBeNull();
  });

  it("exige Node 24 ou superior", () => {
    expect(avaliarNode("v24.0.0").ok).toBe(true);
    expect(avaliarNode("v22.9.0").ok).toBe(false);
    expect(avaliarNode("").ok).toBe(false);
  });

  it("lista só os nomes das variáveis ausentes ou vazias", () => {
    const env = "NEXT_PUBLIC_SUPABASE_URL=http://x\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\n";
    expect(variaveisAusentes(env)).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]);
  });

  it("não imprime valores do .env.local", async () => {
    const itens = await diagnosticar({
      versao: () => "27.1.0",
      portaLivre: async () => true,
      existe: () => true,
      ler: () => "NEXT_PUBLIC_SUPABASE_URL=segredo-url\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=segredo-pub\nSUPABASE_SECRET_KEY=segredo-sec\n",
      nodeVersion: "v24.1.0",
    });
    const saida = formatar(itens);
    expect(saida).not.toContain("segredo");
    expect(itens.every((i) => i.ok)).toBe(true);
  });

  it("reprova sem Docker e sem .env.local; porta ocupada é só aviso", async () => {
    const itens = await diagnosticar({
      versao: () => null,
      portaLivre: async (p: number) => p !== 54321,
      existe: () => false,
      nodeVersion: "v24.1.0",
    });
    expect(itens.find((i) => i.nome === "Docker")?.ok).toBe(false);
    expect(itens.find((i) => i.nome === ".env.local")?.ok).toBe(false);
    const porta = itens.find((i) => i.nome === "Porta 54321");
    expect(porta?.ok).toBe(true);
    expect(porta?.aviso).toBe(true);
  });
});
