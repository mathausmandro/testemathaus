import { describe, expect, it } from "vitest";
import { avaliarPedido, ehUrlLocal, lerRefVinculado, podeResetar } from "../../scripts/db-remoto.mjs";

const env = {
  SUPABASE_PROJECT_REF_TESTE: "abcdefghij1234567890",
  SUPABASE_PROJECT_REF_PRODUCAO: "zyxwvutsrq0987654321",
  SUPABASE_ACCESS_TOKEN: "token-ficticio",
};

describe("guarda contra banco remoto", () => {
  it("reconhece só URLs locais", () => {
    expect(ehUrlLocal("http://127.0.0.1:54321")).toBe(true);
    expect(ehUrlLocal("http://localhost:54322")).toBe(true);
    expect(ehUrlLocal("https://projeto.exemplo.invalid")).toBe(false);
    expect(ehUrlLocal("http://localhost.exemplo.invalid")).toBe(false);
    expect(ehUrlLocal("lixo")).toBe(false);
  });

  it("db reset só é permitido em URL local", () => {
    expect(podeResetar("http://127.0.0.1:54321")).toBe(true);
    expect(podeResetar("https://projeto.exemplo.invalid")).toBe(false);
    expect(podeResetar(undefined)).toBe(false);
    expect(podeResetar("")).toBe(false);
  });

  it("recusa reset e comandos fora da lista", () => {
    expect(avaliarPedido(["reset", "teste"], env).ok).toBe(false);
    expect(avaliarPedido(["db", "teste"], env).ok).toBe(false);
    expect(avaliarPedido(["push", "teste", "reset"], env).ok).toBe(false);
  });

  const vinculoTeste = { refVinculado: env.SUPABASE_PROJECT_REF_TESTE };
  const vinculoProducao = { refVinculado: env.SUPABASE_PROJECT_REF_PRODUCAO };

  it("push em teste funciona; produção exige confirmação explícita", () => {
    expect(avaliarPedido(["push", "teste"], env, vinculoTeste)).toEqual({ ok: true, args: ["db", "push"] });
    expect(avaliarPedido(["push", "producao"], env, vinculoProducao).ok).toBe(false);
    expect(avaliarPedido(["push", "producao", "--confirmo=producao"], env, vinculoProducao).ok).toBe(true);
  });

  it("M2: push teste com a pasta vinculada à produção é recusado, sem imprimir refs", () => {
    const r = avaliarPedido(["push", "teste"], env, vinculoProducao);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/vinculada a outro projeto/);
    expect(r.motivo).not.toContain(env.SUPABASE_PROJECT_REF_PRODUCAO);
    expect(r.motivo).not.toContain(env.SUPABASE_PROJECT_REF_TESTE);
  });

  it("M2: push producao com a pasta vinculada ao teste é recusado mesmo com a confirmação", () => {
    expect(avaliarPedido(["push", "producao", "--confirmo=producao"], env, vinculoTeste).ok).toBe(false);
  });

  it("M2: push sem vínculo é recusado; link não depende do vínculo atual", () => {
    expect(avaliarPedido(["push", "teste"], env).ok).toBe(false);
    expect(avaliarPedido(["push", "teste"], env, { refVinculado: null }).motivo).toMatch(/Nenhum projeto vinculado/);
    expect(avaliarPedido(["link", "teste"], env, vinculoProducao).ok).toBe(true);
  });

  it("lê o ref vinculado de supabase/.temp/project-ref", () => {
    const lidos: string[] = [];
    const ler = (p: string) => {
      lidos.push(p.replace(/\\/g, "/"));
      return "  abcdefghij1234567890\n";
    };
    expect(lerRefVinculado("/raiz", ler)).toBe("abcdefghij1234567890");
    expect(lidos[0]).toMatch(/supabase\/\.temp\/project-ref$/);
    expect(lerRefVinculado("/raiz", () => null)).toBeNull();
    expect(lerRefVinculado("/raiz", () => "   ")).toBeNull();
  });

  it("exige referência, token e projetos distintos", () => {
    expect(avaliarPedido(["push", "teste"], { ...env, SUPABASE_PROJECT_REF_TESTE: undefined }, vinculoTeste).ok).toBe(false);
    expect(avaliarPedido(["push", "teste"], { ...env, SUPABASE_ACCESS_TOKEN: undefined }, vinculoTeste).ok).toBe(false);
    expect(avaliarPedido(["push", "teste"], { ...env, SUPABASE_PROJECT_REF_PRODUCAO: env.SUPABASE_PROJECT_REF_TESTE }, vinculoTeste).ok).toBe(false);
  });

  it("link usa a referência do ambiente escolhido", () => {
    expect(avaliarPedido(["link", "teste"], env)).toEqual({ ok: true, args: ["link", "--project-ref", env.SUPABASE_PROJECT_REF_TESTE] });
  });
});
