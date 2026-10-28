import { describe, expect, it } from "vitest";
import { avaliarPedido, ehUrlLocal, podeResetar } from "../../scripts/db-remoto.mjs";

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

  it("push em teste funciona; produção exige confirmação explícita", () => {
    expect(avaliarPedido(["push", "teste"], env)).toEqual({ ok: true, args: ["db", "push"] });
    expect(avaliarPedido(["push", "producao"], env).ok).toBe(false);
    expect(avaliarPedido(["push", "producao", "--confirmo=producao"], env).ok).toBe(true);
  });

  it("exige referência, token e projetos distintos", () => {
    expect(avaliarPedido(["push", "teste"], { ...env, SUPABASE_PROJECT_REF_TESTE: undefined }).ok).toBe(false);
    expect(avaliarPedido(["push", "teste"], { ...env, SUPABASE_ACCESS_TOKEN: undefined }).ok).toBe(false);
    expect(avaliarPedido(["push", "teste"], { ...env, SUPABASE_PROJECT_REF_PRODUCAO: env.SUPABASE_PROJECT_REF_TESTE }).ok).toBe(false);
  });

  it("link usa a referência do ambiente escolhido", () => {
    expect(avaliarPedido(["link", "teste"], env)).toEqual({ ok: true, args: ["link", "--project-ref", env.SUPABASE_PROJECT_REF_TESTE] });
  });
});
