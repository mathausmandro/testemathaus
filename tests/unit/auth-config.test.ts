import { describe, expect, it } from "vitest";
import { ehUrlLocal, lerConfigDeLogin, loginLocalPermitido, mensagemDeLogin, origemDoSite, origemDosCabecalhos } from "@/lib/auth/config";
import { CABECALHOS_SEM_CACHE, opcoesDoCookieDeSessao } from "@/lib/data/cookie-options";

const LOCAL = "http://127.0.0.1:54321";
const REMOTO = "https://projeto-ficticio.supabase.test";

describe("modo de login local por senha", () => {
  it("liga só com a variável true e Supabase local", () => {
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(true);
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "TRUE", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" })).toBe(true);
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: "http://host.docker.internal:54321" })).toBe(true);
  });

  it("fica desligado sem a variável", () => {
    expect(loginLocalPermitido({ NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(false);
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "1", NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(false);
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "", NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(false);
  });

  it("nunca liga com Supabase remoto (teste ou produção), mesmo com a variável", () => {
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: REMOTO })).toBe(false);
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: "https://127.0.0.1.supabase.test" })).toBe(false);
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: undefined })).toBe(false);
    expect(loginLocalPermitido({ AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: "não é url" })).toBe(false);
  });

  it("nunca liga em implantação da Vercel (preview ou produção) nem com APP_ENV=production", () => {
    const base = { AUTH_LOCAL_PASSWORD_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: LOCAL };
    expect(loginLocalPermitido({ ...base, VERCEL_ENV: "production" })).toBe(false);
    expect(loginLocalPermitido({ ...base, VERCEL_ENV: "preview" })).toBe(false);
    expect(loginLocalPermitido({ ...base, APP_ENV: "production" })).toBe(false);
    expect(loginLocalPermitido({ ...base, VERCEL_ENV: "development" })).toBe(true);
  });

  it("reconhece URLs locais", () => {
    expect(ehUrlLocal("http://[::1]:54321")).toBe(true);
    expect(ehUrlLocal("https://localhost.exemplo.test")).toBe(false);
  });
});

describe("leitura da configuração", () => {
  it("sem variáveis: Microsoft e login local desligados", () => {
    expect(lerConfigDeLogin({})).toEqual({ microsoftHabilitado: false, loginLocalPorSenha: false, urlDoSite: null });
  });

  it("Microsoft liga com AUTH_MICROSOFT_ENABLED=true", () => {
    expect(lerConfigDeLogin({ AUTH_MICROSOFT_ENABLED: "true" }).microsoftHabilitado).toBe(true);
    expect(lerConfigDeLogin({ AUTH_MICROSOFT_ENABLED: "sim" }).microsoftHabilitado).toBe(false);
  });

  it("SITE_URL vira só a origem; valores inválidos são ignorados", () => {
    expect(lerConfigDeLogin({ SITE_URL: "https://app.exemplo.test/qualquer" }).urlDoSite).toBe("https://app.exemplo.test");
    expect(lerConfigDeLogin({ SITE_URL: "javascript:alert(1)" }).urlDoSite).toBeNull();
    expect(lerConfigDeLogin({ SITE_URL: "lixo" }).urlDoSite).toBeNull();
  });

  it("origemDoSite usa SITE_URL quando existe", () => {
    const c = lerConfigDeLogin({ SITE_URL: "https://app.exemplo.test" });
    expect(origemDoSite(c, "http://localhost:3000/x")).toBe("https://app.exemplo.test");
    expect(origemDoSite(lerConfigDeLogin({}), "http://localhost:3000/x")).toBe("http://localhost:3000");
  });

  it("origem pelos cabeçalhos recusa host malformado", () => {
    const h = (m: Record<string, string>) => (n: string) => m[n] ?? null;
    expect(origemDosCabecalhos(h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(origemDosCabecalhos(h({ host: "interno", "x-forwarded-host": "app.exemplo.test", "x-forwarded-proto": "https" }))).toBe(
      "https://app.exemplo.test",
    );
    expect(origemDosCabecalhos(h({ host: "evil.example/@x" }))).toBe("http://localhost");
    expect(origemDosCabecalhos(h({}))).toBe("http://localhost");
  });
});

describe("mensagens de erro do login", () => {
  it("só códigos conhecidos viram mensagem; texto livre da URL é ignorado", () => {
    expect(mensagemDeLogin("credenciais")).toBe("E-mail ou senha inválidos.");
    expect(mensagemDeLogin(["callback"])).toMatch(/concluir a entrada/);
    expect(mensagemDeLogin("<script>")).toBeNull();
    expect(mensagemDeLogin("toString")).toBeNull();
    expect(mensagemDeLogin(undefined)).toBeNull();
  });
});

describe("cookies de sessão", () => {
  it("são HttpOnly, SameSite=Lax e path /", () => {
    const o = opcoesDoCookieDeSessao("development");
    expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(o.secure).toBe(false);
  });

  it("são Secure em produção", () => {
    expect(opcoesDoCookieDeSessao("production").secure).toBe(true);
  });

  it("respostas com sessão não vão para cache compartilhado", () => {
    expect(CABECALHOS_SEM_CACHE["Cache-Control"]).toMatch(/private/);
    expect(CABECALHOS_SEM_CACHE["Cache-Control"]).toMatch(/no-store/);
  });
});
