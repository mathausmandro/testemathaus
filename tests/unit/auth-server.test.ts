// @vitest-environment node
// Helpers de servidor chamados direto (como faria uma Server Action ou um Route Handler).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { url: "404" });
  }),
}));
vi.mock("@/lib/data/server/session", () => ({ obterSessao: m.obterSessao }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));

import { DataError } from "@/lib/data/errors";
import { exigirPerfil, exigirPerfilNaPagina, exigirSessao, exigirSessaoSemPerfilNaPagina } from "@/lib/auth/server";

const sessao = (role: string | null) => ({ userId: "u1", email: "a@exemplo.test", perfil: role === undefined ? null : { role } });
const destino = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as { url: string }).url;

beforeEach(() => vi.stubEnv("ALLOWED_EMAIL_DOMAIN", "exemplo.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("domínio do e-mail na sessão (M1)", () => {
  const fora = { userId: "u2", email: "a@outro.test", perfil: { role: "coordination" } };

  it("fora de ALLOWED_EMAIL_DOMAIN: tratado como sem sessão em actions e páginas", async () => {
    m.obterSessao.mockResolvedValue(fora);
    await expect(exigirSessao()).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(exigirPerfil(["coordination"])).rejects.toMatchObject({ code: "unauthenticated" });
    expect(await destino(exigirPerfilNaPagina())).toBe("/login");
    expect(await destino(exigirSessaoSemPerfilNaPagina())).toBe("/login");
  });

  it("subdomínio e sufixo parecidos são recusados", async () => {
    for (const email of ["a@sub.exemplo.test", "a@exemplo.test.evil.test", "a@outro.test@exemplo.test"]) {
      m.obterSessao.mockResolvedValue({ ...fora, email });
      await expect(exigirSessao(), email).rejects.toMatchObject({ code: "unauthenticated" });
    }
  });

  it("sem ALLOWED_EMAIL_DOMAIN e fora do modo local: ninguém entra", async () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAIN", "");
    m.obterSessao.mockResolvedValue(sessao("coordination"));
    await expect(exigirSessao()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("modo local: usuário fictício exemplo.test entra mesmo sem ALLOWED_EMAIL_DOMAIN", async () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAIN", "");
    vi.stubEnv("AUTH_LOCAL_PASSWORD_LOGIN", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_ENV", "");
    m.obterSessao.mockResolvedValue(sessao("field"));
    await expect(exigirSessao()).resolves.toMatchObject({ userId: "u1" });
  });
});

describe("Server Actions e Route Handlers", () => {
  it("sem sessão: unauthenticated", async () => {
    m.obterSessao.mockResolvedValue(null);
    await expect(exigirSessao()).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(exigirPerfil()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("sem perfil: forbidden", async () => {
    m.obterSessao.mockResolvedValue(sessao(null));
    await expect(exigirPerfil()).rejects.toBeInstanceOf(DataError);
    await expect(exigirPerfil()).rejects.toMatchObject({ code: "forbidden" });
    await expect(exigirSessao()).resolves.toMatchObject({ userId: "u1" });
  });

  it("perfil fora da lista: forbidden; dentro: ok", async () => {
    m.obterSessao.mockResolvedValue(sessao("home_office"));
    await expect(exigirPerfil(["coordination"])).rejects.toMatchObject({ code: "forbidden" });
    await expect(exigirPerfil(["coordination", "home_office"])).resolves.toMatchObject({ perfil: { role: "home_office" } });
  });

  it("mensagem padronizada em pt-BR", async () => {
    m.obterSessao.mockResolvedValue(null);
    await expect(exigirPerfil()).rejects.toThrow("Sua sessão expirou. Entre novamente.");
  });
});

describe("páginas", () => {
  it("sem sessão: login; sem perfil: aguardando; sem permissão: 404", async () => {
    m.obterSessao.mockResolvedValue(null);
    expect(await destino(exigirPerfilNaPagina())).toBe("/login");
    m.obterSessao.mockResolvedValue(sessao(null));
    expect(await destino(exigirPerfilNaPagina())).toBe("/aguardando");
    m.obterSessao.mockResolvedValue(sessao("field"));
    expect(await destino(exigirPerfilNaPagina(["coordination"]))).toBe("404");
    await expect(exigirPerfilNaPagina()).resolves.toMatchObject({ perfil: { role: "field" } });
  });

  it("aguardando: exige sessão e manda quem tem perfil ao início", async () => {
    m.obterSessao.mockResolvedValue(null);
    expect(await destino(exigirSessaoSemPerfilNaPagina())).toBe("/login");
    m.obterSessao.mockResolvedValue(sessao("coordination"));
    expect(await destino(exigirSessaoSemPerfilNaPagina())).toBe("/inicio");
    m.obterSessao.mockResolvedValue(sessao(null));
    await expect(exigirSessaoSemPerfilNaPagina()).resolves.toMatchObject({ userId: "u1" });
  });
});
