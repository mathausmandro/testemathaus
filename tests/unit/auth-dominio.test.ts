// @vitest-environment node
// M1 (docs/seguranca/003-019.md): domínio do e-mail conferido também no servidor.
import { describe, expect, it } from "vitest";
import { emailCorrespondeAoDominio, emailPermitidoNaSessao, normalizarDominio } from "@/lib/auth/dominio";

const local = { AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };

describe("emailCorrespondeAoDominio", () => {
  it("normaliza o domínio", () => {
    expect(normalizarDominio("  @Empresa-Ficticia.TEST ")).toBe("empresa-ficticia.test");
    expect(normalizarDominio("")).toBeNull();
    expect(normalizarDominio(undefined)).toBeNull();
  });

  it.each(["ana@empresa-ficticia.test", "Ana.Silva@EMPRESA-FICTICIA.TEST", "  ana@empresa-ficticia.test ", "ana+campo@empresa-ficticia.test"])(
    "aceita %j",
    (e) => expect(emailCorrespondeAoDominio(e, "empresa-ficticia.test")).toBe(true),
  );

  it.each([
    "ana@outro.test",
    "ana@sub.empresa-ficticia.test",
    "ana@empresa-ficticia.test.evil.test",
    "ana@xempresa-ficticia.test",
    "ana@outro.test@empresa-ficticia.test",
    "ana silva@empresa-ficticia.test",
    "@empresa-ficticia.test",
    "ana@",
    "",
  ])("recusa %j", (e) => expect(emailCorrespondeAoDominio(e, "empresa-ficticia.test")).toBe(false));

  it("sem domínio ou sem e-mail não há correspondência", () => {
    expect(emailCorrespondeAoDominio("ana@empresa-ficticia.test", undefined)).toBe(false);
    expect(emailCorrespondeAoDominio(null, "empresa-ficticia.test")).toBe(false);
  });
});

describe("emailPermitidoNaSessao", () => {
  it("usa ALLOWED_EMAIL_DOMAIN", () => {
    expect(emailPermitidoNaSessao("ana@empresa-ficticia.test", { ALLOWED_EMAIL_DOMAIN: "empresa-ficticia.test" })).toBe(true);
    expect(emailPermitidoNaSessao("ana@outro.test", { ALLOWED_EMAIL_DOMAIN: "empresa-ficticia.test" })).toBe(false);
  });

  it("padrão seguro: sem ALLOWED_EMAIL_DOMAIN ninguém entra", () => {
    expect(emailPermitidoNaSessao("ana@empresa-ficticia.test", {})).toBe(false);
    expect(emailPermitidoNaSessao("coordenacao@exemplo.test", {})).toBe(false);
  });

  it("modo local aceita só o domínio reservado exemplo.test, além do configurado", () => {
    expect(emailPermitidoNaSessao("coordenacao@exemplo.test", local)).toBe(true);
    expect(emailPermitidoNaSessao("coordenacao@sub.exemplo.test", local)).toBe(false);
    expect(emailPermitidoNaSessao("ana@outro.test", local)).toBe(false);
  });

  it("exemplo.test não vale fora do modo local (produção, Vercel ou Supabase remoto)", () => {
    expect(emailPermitidoNaSessao("coordenacao@exemplo.test", { ...local, APP_ENV: "production" })).toBe(false);
    expect(emailPermitidoNaSessao("coordenacao@exemplo.test", { ...local, VERCEL_ENV: "preview" })).toBe(false);
    expect(emailPermitidoNaSessao("coordenacao@exemplo.test", { ...local, NEXT_PUBLIC_SUPABASE_URL: "https://projeto.exemplo.invalid" })).toBe(false);
  });
});
