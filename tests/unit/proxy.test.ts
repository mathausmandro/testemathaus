// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ criarCliente: vi.fn(), atualizar: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: m.criarCliente }));

import { atualizarSessaoNoProxy } from "@/lib/data/proxy-session";

const BASE = "http://localhost:3000";
const req = (p: string, cookie?: string) => new NextRequest(`${BASE}${p}`, cookie ? { headers: { cookie } } : undefined);

function clienteFalso(opts: { claims?: unknown; erroClaims?: unknown; perfil?: unknown; erroPerfil?: unknown; lanca?: boolean }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.perfil ?? null, error: opts.erroPerfil ?? null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return {
    auth: {
      getClaims: opts.lanca
        ? vi.fn().mockRejectedValue(new Error("rede"))
        : vi.fn().mockResolvedValue({ data: opts.claims ? { claims: opts.claims } : null, error: opts.erroClaims ?? null }),
    },
    from: vi.fn(() => ({ select })),
    _eq: eq,
  };
}

function envLocal() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("atualizarSessaoNoProxy", () => {
  it("sem variáveis de ambiente: anônimo, sem chamar o Supabase", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { estado } = await atualizarSessaoNoProxy(req("/inicio"));
    expect(estado).toEqual({ tipo: "anonimo" });
    expect(m.criarCliente).not.toHaveBeenCalled();
  });

  it("sem claims: anônimo", async () => {
    envLocal();
    m.criarCliente.mockReturnValue(clienteFalso({}));
    expect((await atualizarSessaoNoProxy(req("/inicio"))).estado).toEqual({ tipo: "anonimo" });
  });

  it("token inválido: anônimo", async () => {
    envLocal();
    m.criarCliente.mockReturnValue(clienteFalso({ erroClaims: { message: "jwt" } }));
    expect((await atualizarSessaoNoProxy(req("/inicio"))).estado).toEqual({ tipo: "anonimo" });
  });

  it("com sessão e sem perfil (ou role nula): sem_perfil", async () => {
    envLocal();
    m.criarCliente.mockReturnValue(clienteFalso({ claims: { sub: "u1" }, perfil: { role: null } }));
    expect((await atualizarSessaoNoProxy(req("/inicio"))).estado).toEqual({ tipo: "sem_perfil" });
    m.criarCliente.mockReturnValue(clienteFalso({ claims: { sub: "u1" }, perfil: null }));
    expect((await atualizarSessaoNoProxy(req("/inicio"))).estado).toEqual({ tipo: "sem_perfil" });
  });

  it("com perfil: consulta o próprio id e devolve o papel", async () => {
    envLocal();
    const c = clienteFalso({ claims: { sub: "u1" }, perfil: { role: "field" } });
    m.criarCliente.mockReturnValue(c);
    expect((await atualizarSessaoNoProxy(req("/inicio"))).estado).toEqual({ tipo: "com_perfil", perfil: "field" });
    expect(c._eq).toHaveBeenCalledWith("id", "u1");
  });

  it("erro ao ler o perfil ou exceção: erro (nunca libera)", async () => {
    envLocal();
    m.criarCliente.mockReturnValue(clienteFalso({ claims: { sub: "u1" }, erroPerfil: { code: "500" } }));
    expect((await atualizarSessaoNoProxy(req("/inicio"))).estado).toEqual({ tipo: "erro" });
    m.criarCliente.mockReturnValue(clienteFalso({ lanca: true }));
    expect((await atualizarSessaoNoProxy(req("/inicio"))).estado).toEqual({ tipo: "erro" });
  });

  it("cookies renovados vão para a resposta com as opções seguras e cabeçalhos sem cache", async () => {
    envLocal();
    m.criarCliente.mockImplementation((_u: string, _k: string, opcoes: { cookieOptions: unknown; cookies: { setAll: (l: unknown[], h: Record<string, string>) => void } }) => {
      expect(opcoes.cookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax" });
      const c = clienteFalso({ claims: { sub: "u1" }, perfil: { role: "coordination" } });
      const original = c.auth.getClaims;
      c.auth.getClaims = vi.fn(async () => {
        opcoes.cookies.setAll([{ name: "sb-x-auth-token", value: "novo", options: { httpOnly: true, path: "/" } }], {
          "Cache-Control": "private, no-store",
        });
        return original();
      });
      return c;
    });
    const { response } = await atualizarSessaoNoProxy(req("/inicio", "sb-x-auth-token=velho"));
    expect(response.cookies.get("sb-x-auth-token")?.value).toBe("novo");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("proxy", () => {
  it("página inicial e callback seguem sem consultar a sessão", async () => {
    vi.resetModules();
    vi.doMock("@/lib/data/proxy-session", () => ({ atualizarSessaoNoProxy: m.atualizar }));
    const { proxy } = await import("@/proxy");
    expect((await proxy(req("/"))).headers.get("x-middleware-next")).toBe("1");
    await proxy(req("/auth/callback?code=x"));
    expect(m.atualizar).not.toHaveBeenCalled();
  });

  it("sem sessão: redireciona ao login, sem cache, levando os cookies apagados", async () => {
    vi.resetModules();
    vi.doMock("@/lib/data/proxy-session", () => ({ atualizarSessaoNoProxy: m.atualizar }));
    const { proxy } = await import("@/proxy");
    const resp = NextResponse.next();
    resp.cookies.set("sb-x-auth-token", "", { maxAge: 0 });
    m.atualizar.mockResolvedValue({ estado: { tipo: "anonimo" }, response: resp });
    const r = await proxy(req("/admin?aba=1"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe(`${BASE}/login?next=%2Fadmin%3Faba%3D1`);
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(r.cookies.get("sb-x-auth-token")?.value).toBe("");
  });

  it("com perfil permitido: segue com cabeçalhos sem cache", async () => {
    vi.resetModules();
    vi.doMock("@/lib/data/proxy-session", () => ({ atualizarSessaoNoProxy: m.atualizar }));
    const { proxy } = await import("@/proxy");
    m.atualizar.mockResolvedValue({ estado: { tipo: "com_perfil", perfil: "coordination" }, response: NextResponse.next() });
    const r = await proxy(req("/admin"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
    expect(r.headers.get("cache-control")).toMatch(/private/);
  });

  it("field em /admin: volta ao início", async () => {
    vi.resetModules();
    vi.doMock("@/lib/data/proxy-session", () => ({ atualizarSessaoNoProxy: m.atualizar }));
    const { proxy } = await import("@/proxy");
    m.atualizar.mockResolvedValue({ estado: { tipo: "com_perfil", perfil: "field" }, response: NextResponse.next() });
    expect((await proxy(req("/admin"))).headers.get("location")).toBe(`${BASE}/inicio`);
  });
});

describe("proxy: CSP com nonce por requisição (tarefa 017)", () => {
  async function proxyComSessao(estado: unknown) {
    vi.resetModules();
    vi.doMock("@/lib/data/proxy-session", () => ({ atualizarSessaoNoProxy: m.atualizar }));
    m.atualizar.mockImplementation(async (r: NextRequest) => ({ estado, response: NextResponse.next({ request: r }) }));
    return (await import("@/proxy")).proxy;
  }

  it.each([
    ["/", { tipo: "anonimo" }],
    ["/login", { tipo: "anonimo" }],
    ["/admin", { tipo: "anonimo" }],
    ["/admin", { tipo: "com_perfil", perfil: "field" }],
    ["/inicio", { tipo: "com_perfil", perfil: "field" }],
    ["/inicio", { tipo: "erro" }],
  ])("%s (%o): resposta leva a CSP e o nonce vai para a requisição", async (rota, estado) => {
    const proxy = await proxyComSessao(estado);
    const r = await proxy(req(rota));
    const csp = r.headers.get("content-security-policy")!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    if (r.headers.get("x-middleware-next") === "1") {
      // NextResponse.next({ request }) repassa os cabeçalhos alterados da requisição ao Next.
      const nonce = /'nonce-([^']+)'/.exec(csp)![1];
      expect(r.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
      expect(r.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    }
  });

  it("nonce novo a cada requisição", async () => {
    const proxy = await proxyComSessao({ tipo: "anonimo" });
    const a = (await proxy(req("/"))).headers.get("content-security-policy");
    const b = (await proxy(req("/"))).headers.get("content-security-policy");
    expect(a).not.toBe(b);
  });

  it("connect-src usa NEXT_PUBLIC_SUPABASE_URL; HTTPS liga upgrade-insecure-requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projeto-ficticio.supabase.test");
    const proxy = await proxyComSessao({ tipo: "anonimo" });
    const csp = (await proxy(new NextRequest("https://app.exemplo.test/"))).headers.get("content-security-policy")!;
    expect(csp).toContain("connect-src 'self' https://projeto-ficticio.supabase.test wss://projeto-ficticio.supabase.test");
    expect(csp).toContain("upgrade-insecure-requests");
    const local = (await proxy(req("/"))).headers.get("content-security-policy")!;
    expect(local).not.toContain("upgrade-insecure-requests");
  });

  it("sem unsafe-eval fora do next dev", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const proxy = await proxyComSessao({ tipo: "anonimo" });
    expect((await proxy(req("/"))).headers.get("content-security-policy")).not.toMatch(/unsafe-eval|unsafe-inline/);
  });
});
