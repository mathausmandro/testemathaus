// @vitest-environment node
// Operações de autenticação sem banco: a URL de autorização é montada pelo próprio cliente
// (sem rede) a partir de uma URL FICTÍCIA do Supabase; nada de tenant ou client id no código.
import { createServerClient } from "@supabase/ssr";
import { describe, expect, it, vi } from "vitest";
import { entrarComSenha, iniciarLoginMicrosoft, opcoesOAuthMicrosoft, sair, trocarCodigoPorSessao } from "@/lib/data/auth";
import { opcoesDoCookieDeSessao } from "@/lib/data/cookie-options";
import { DataError } from "@/lib/data/errors";
import type { DbClient } from "@/lib/data/types";

const SUPABASE_FICTICIO = "https://projeto-ficticio.supabase.test";
const CALLBACK = "http://localhost:3000/auth/callback?next=%2Fensaios";

function clienteComCookiesEmMemoria() {
  const gravados: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const db = createServerClient(SUPABASE_FICTICIO, "chave-publicavel-ficticia", {
    cookieOptions: opcoesDoCookieDeSessao("production"),
    cookies: {
      getAll: () => gravados.map(({ name, value }) => ({ name, value })),
      setAll: (lista) => {
        for (const c of lista) gravados.push({ name: c.name, value: c.value, options: c.options as Record<string, unknown> });
      },
    },
  }) as unknown as DbClient;
  return { db, gravados };
}

describe("login Microsoft (PKCE)", () => {
  it("usa o provedor azure do Supabase com retorno para o callback", () => {
    const o = opcoesOAuthMicrosoft(CALLBACK);
    expect(o.provider).toBe("azure");
    expect(o.options.redirectTo).toBe(CALLBACK);
    expect(o.options.skipBrowserRedirect).toBe(true);
    expect(o.options.scopes).toContain("email");
  });

  it("monta a URL de autorização apontando para o Supabase configurado, com PKCE", async () => {
    const { db, gravados } = clienteComCookiesEmMemoria();
    const url = new URL(await iniciarLoginMicrosoft(db, CALLBACK));
    expect(url.origin).toBe(SUPABASE_FICTICIO);
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("azure");
    expect(url.searchParams.get("redirect_to")).toBe(CALLBACK);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")?.toLowerCase()).toBe("s256");

    const verificador = gravados.find((c) => c.name.endsWith("-code-verifier"));
    expect(verificador, "verificador do PKCE gravado em cookie").toBeDefined();
    expect(verificador?.options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true });
  });

  it("falha do Auth vira erro padronizado", async () => {
    const db = { auth: { signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: null }, error: { message: "x" } }) } } as unknown as DbClient;
    await expect(iniciarLoginMicrosoft(db, CALLBACK)).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("callback e sessão", () => {
  it("código inválido vira unauthenticated", async () => {
    const db = { auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { status: 400 } }) } } as unknown as DbClient;
    await expect(trocarCodigoPorSessao(db, "abc")).rejects.toBeInstanceOf(DataError);
  });

  it("sair encerra só a sessão local", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await sair({ auth: { signOut } } as unknown as DbClient);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("login por senha (usuários de teste locais)", () => {
  it("valida a entrada antes de chamar o Auth", async () => {
    const signInWithPassword = vi.fn();
    const db = { auth: { signInWithPassword } } as unknown as DbClient;
    await expect(entrarComSenha(db, { email: "não-é-email", senha: "x" })).rejects.toMatchObject({ code: "invalid" });
    await expect(entrarComSenha(db, { email: "a@exemplo.test", senha: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(entrarComSenha(db, { email: null, senha: null })).rejects.toMatchObject({ code: "invalid" });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("erro do Auth vira mensagem genérica (sem enumerar usuários)", async () => {
    const db = {
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: { status: 400, message: "Invalid login credentials" } }) },
    } as unknown as DbClient;
    const e = await entrarComSenha(db, { email: "a@exemplo.test", senha: "x" }).catch((x) => x);
    expect(e).toBeInstanceOf(DataError);
    expect(e.message).not.toMatch(/Invalid|credentials|exist/i);
  });

  it("e-mail com espaços é normalizado", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    await entrarComSenha({ auth: { signInWithPassword } } as unknown as DbClient, { email: "  a@exemplo.test ", senha: "x" });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@exemplo.test", password: "x" });
  });
});
