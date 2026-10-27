import { describe, expect, it } from "vitest";
import { caminhoDeRetornoSeguro, DESTINO_PADRAO, PREFIXOS_DE_RETORNO } from "@/lib/auth/redirect";

describe("caminhoDeRetornoSeguro (sem open redirect)", () => {
  it.each([
    ["/inicio", "/inicio"],
    ["/ensaios/123?aba=croqui", "/ensaios/123?aba=croqui"],
    ["/admin/perfis#lista", "/admin/perfis#lista"],
    ["/ensaios/../admin", "/admin"],
  ])("aceita caminho interno permitido %s", (entrada, esperado) => {
    expect(caminhoDeRetornoSeguro(entrada)).toBe(esperado);
  });

  it.each([
    "https://outro-site.example",
    "http://outro-site.example/inicio",
    "//outro-site.example",
    "//outro-site.example/inicio",
    "/\\outro-site.example",
    "\\\\outro-site.example",
    "javascript:alert(1)",
    "data:text/html,oi",
    "inicio",
    " https://outro-site.example",
    "/inicio\n//outro-site.example",
    "/%2F%2Foutro-site.example",
    "/login",
    "/auth/callback",
    "/inicio-falso",
    "/ensaios/../../login",
    "",
    "/" + "a".repeat(600),
  ])("recusa %j e devolve o padrão", (entrada) => {
    expect(caminhoDeRetornoSeguro(entrada)).toBe(DESTINO_PADRAO);
  });

  it("recusa valores ausentes ou de outro tipo", () => {
    expect(caminhoDeRetornoSeguro(null)).toBe(DESTINO_PADRAO);
    expect(caminhoDeRetornoSeguro(undefined)).toBe(DESTINO_PADRAO);
    expect(caminhoDeRetornoSeguro(42 as unknown as string)).toBe(DESTINO_PADRAO);
  });

  it("o resultado nunca é URL absoluta", () => {
    for (const p of PREFIXOS_DE_RETORNO) {
      const r = caminhoDeRetornoSeguro(`${p}/x`);
      expect(r.startsWith("/")).toBe(true);
      expect(r.startsWith("//")).toBe(false);
    }
  });

  it("aceita padrão personalizado", () => {
    expect(caminhoDeRetornoSeguro("https://x.example", "/ensaios")).toBe("/ensaios");
  });
});
