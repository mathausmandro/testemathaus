// @vitest-environment node
// Server Actions do login e do logout, chamadas direto (sem passar pela tela).
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  criarServidor: vi.fn(),
  limpar: vi.fn(),
  iniciar: vi.fn(),
  entrar: vi.fn(),
  sair: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }) }));
vi.mock("@/lib/data/server/server-client", () => ({ createServerSupabase: m.criarServidor, limparCookiesDaSessao: m.limpar }));
vi.mock("@/lib/data/auth", () => ({ iniciarLoginMicrosoft: m.iniciar, entrarComSenha: m.entrar, sair: m.sair }));

import { entrarComMicrosoft, entrarComSenhaLocal } from "@/app/(auth)/login/actions";
import { sairDaConta } from "@/app/(auth)/actions";

const destino = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as { url: string }).url;
const form = (dados: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(dados)) f.set(k, v);
  return f;
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("entrarComMicrosoft", () => {
  it("sem provedor configurado: não chama o Supabase", async () => {
    vi.stubEnv("AUTH_MICROSOFT_ENABLED", "");
    expect(await destino(entrarComMicrosoft(form({ next: "/ensaios" })))).toBe("/login?erro=indisponivel");
    expect(m.iniciar).not.toHaveBeenCalled();
  });

  it("com provedor: manda para a URL de autorização com callback e next validado", async () => {
    vi.stubEnv("AUTH_MICROSOFT_ENABLED", "true");
    m.criarServidor.mockResolvedValue({});
    m.iniciar.mockResolvedValue("https://projeto-ficticio.supabase.test/auth/v1/authorize?provider=azure");
    const url = await destino(entrarComMicrosoft(form({ next: "https://outro-site.example" })));
    expect(url).toBe("https://projeto-ficticio.supabase.test/auth/v1/authorize?provider=azure");
    expect(m.iniciar).toHaveBeenCalledWith({}, "http://localhost:3000/auth/callback?next=%2Finicio");
  });

  it("falha do Auth: volta ao login com aviso", async () => {
    vi.stubEnv("AUTH_MICROSOFT_ENABLED", "true");
    m.criarServidor.mockRejectedValue(new Error("env"));
    expect(await destino(entrarComMicrosoft(form({})))).toBe("/login?erro=indisponivel");
  });
});

describe("entrarComSenhaLocal", () => {
  it("fora do ambiente local, recusa mesmo com POST direto", async () => {
    vi.stubEnv("AUTH_LOCAL_PASSWORD_LOGIN", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projeto-ficticio.supabase.test");
    expect(await destino(entrarComSenhaLocal(form({ email: "a@exemplo.test", senha: "x" })))).toBe("/login?erro=indisponivel");
    expect(m.entrar).not.toHaveBeenCalled();
  });

  it("no ambiente local: entra e vai para o next", async () => {
    vi.stubEnv("AUTH_LOCAL_PASSWORD_LOGIN", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    m.criarServidor.mockResolvedValue({});
    m.entrar.mockResolvedValue(undefined);
    expect(await destino(entrarComSenhaLocal(form({ email: "a@exemplo.test", senha: "x", next: "/admin" })))).toBe("/admin");
  });

  it("credenciais erradas: mensagem única", async () => {
    vi.stubEnv("AUTH_LOCAL_PASSWORD_LOGIN", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    m.criarServidor.mockResolvedValue({});
    m.entrar.mockRejectedValue(new Error("x"));
    expect(await destino(entrarComSenhaLocal(form({ email: "a@exemplo.test", senha: "x" })))).toBe(
      "/login?erro=credenciais&next=%2Finicio",
    );
  });
});

describe("sairDaConta", () => {
  it("encerra a sessão, limpa cookies e volta ao login", async () => {
    m.criarServidor.mockResolvedValue({});
    expect(await destino(sairDaConta())).toBe("/login");
    expect(m.sair).toHaveBeenCalled();
    expect(m.limpar).toHaveBeenCalled();
  });

  it("limpa os cookies mesmo se o Auth falhar", async () => {
    m.criarServidor.mockRejectedValue(new Error("fora do ar"));
    expect(await destino(sairDaConta())).toBe("/login");
    expect(m.limpar).toHaveBeenCalled();
  });
});
