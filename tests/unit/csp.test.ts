// @vitest-environment node
// Tarefa 017: montagem da CSP com nonce e dos cabeçalhos fixos de segurança.
import { describe, expect, it } from "vitest";
import { gerarNonce, montarCsp, nonceDaCsp, origensDoSupabase } from "@/lib/security/csp";
import { cabecalhosDeSeguranca, HSTS } from "@/lib/security/headers";

const diretiva = (csp: string, nome: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${nome} `) || d === nome);

const base = { nonce: "abc123==", desenvolvimento: false, https: false };

describe("gerarNonce", () => {
  it("é base64 de 128 bits e muda a cada chamada", () => {
    const a = gerarNonce();
    const b = gerarNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(b);
    expect(new Set(Array.from({ length: 200 }, gerarNonce)).size).toBe(200);
  });
});

describe("origensDoSupabase", () => {
  it("https vira origem https e wss (Realtime)", () => {
    expect(origensDoSupabase("https://projeto-ficticio.supabase.test/rest/v1")).toEqual([
      "https://projeto-ficticio.supabase.test",
      "wss://projeto-ficticio.supabase.test",
    ]);
  });

  it("local http vira http e ws, com porta", () => {
    expect(origensDoSupabase("http://127.0.0.1:54321")).toEqual(["http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
  });

  it.each([undefined, "", "não é url", "javascript:alert(1)", "ftp://x.test", "*"])("valor inválido %s: nenhuma origem", (v) => {
    expect(origensDoSupabase(v)).toEqual([]);
  });
});

describe("montarCsp", () => {
  it("produção: nonce, strict-dynamic, sem unsafe-eval e sem unsafe-inline", () => {
    const csp = montarCsp(base);
    expect(diretiva(csp, "script-src")).toBe("script-src 'self' 'nonce-abc123==' 'strict-dynamic'");
    expect(diretiva(csp, "style-src")).toBe("style-src 'self' 'nonce-abc123=='");
    expect(csp).not.toMatch(/unsafe-eval|unsafe-inline/);
  });

  it("desenvolvimento: libera eval (React) e estilos inline (HMR)", () => {
    const csp = montarCsp({ ...base, desenvolvimento: true });
    expect(diretiva(csp, "script-src")).toContain("'unsafe-eval'");
    expect(diretiva(csp, "style-src")).toContain("'unsafe-inline'");
  });

  it("connect-src permite só o próprio site e a URL do Supabase vinda do ambiente", () => {
    const csp = montarCsp({ ...base, supabaseUrl: "https://projeto-ficticio.supabase.test" });
    expect(diretiva(csp, "connect-src")).toBe("connect-src 'self' https://projeto-ficticio.supabase.test wss://projeto-ficticio.supabase.test");
    expect(diretiva(csp, "form-action")).toBe("form-action 'self' https://projeto-ficticio.supabase.test");
    expect(csp).not.toMatch(/\*/);
  });

  it("sem URL do Supabase: connect-src só 'self'", () => {
    expect(diretiva(montarCsp(base), "connect-src")).toBe("connect-src 'self'");
  });

  it("bloqueia iframe, plugins e troca de base", () => {
    const csp = montarCsp(base);
    expect(diretiva(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(diretiva(csp, "object-src")).toBe("object-src 'none'");
    expect(diretiva(csp, "base-uri")).toBe("base-uri 'self'");
    expect(diretiva(csp, "default-src")).toBe("default-src 'self'");
  });

  it("upgrade-insecure-requests só em HTTPS (em http://localhost quebraria o site)", () => {
    expect(montarCsp(base)).not.toContain("upgrade-insecure-requests");
    expect(montarCsp({ ...base, https: true })).toContain("upgrade-insecure-requests");
  });

  it("nonceDaCsp extrai o nonce", () => {
    expect(nonceDaCsp(montarCsp(base))).toBe("abc123==");
    expect(nonceDaCsp("default-src 'self'")).toBeNull();
  });
});

describe("cabecalhosDeSeguranca", () => {
  const mapa = (env: string) => Object.fromEntries(cabecalhosDeSeguranca(env).map((c) => [c.key, c.value]));

  it("produção: HSTS de 2 anos com subdomínios", () => {
    expect(mapa("production")["Strict-Transport-Security"]).toBe(HSTS);
    expect(HSTS).toMatch(/max-age=63072000/);
  });

  it("desenvolvimento e teste: sem HSTS", () => {
    expect(mapa("development")["Strict-Transport-Security"]).toBeUndefined();
    expect(mapa("test")["Strict-Transport-Security"]).toBeUndefined();
  });

  it("câmera e localização só no próprio site; microfone bloqueado; sem iframe; sem sniffing", () => {
    const m = mapa("production");
    expect(m["Permissions-Policy"]).toMatch(/camera=\(self\)/);
    expect(m["Permissions-Policy"]).toMatch(/geolocation=\(self\)/);
    expect(m["Permissions-Policy"]).toMatch(/microphone=\(\)/);
    expect(m["X-Frame-Options"]).toBe("DENY");
    expect(m["X-Content-Type-Options"]).toBe("nosniff");
    expect(m["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});
