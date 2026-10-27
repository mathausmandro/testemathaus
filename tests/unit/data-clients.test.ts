import { afterEach, describe, expect, it, vi } from "vitest";

const { criarBrowser, criarServidor, criarAdmin } = vi.hoisted(() => ({
  criarBrowser: vi.fn(),
  criarServidor: vi.fn(),
  criarAdmin: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createBrowserClient: criarBrowser, createServerClient: criarServidor }));
vi.mock("@supabase/supabase-js", () => ({ createClient: criarAdmin }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

import { EnvError } from "@/lib/env";
import { createBrowserSupabase } from "@/lib/data/client/browser";
import { createAdminSupabase } from "@/lib/data/server/admin";
import { createServerSupabase } from "@/lib/data/server/server-client";

const URL = "http://127.0.0.1:54321";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function envCompleto() {
  criarServidor.mockImplementation(() => ({}));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub");
  vi.stubEnv("SUPABASE_SECRET_KEY", "segredo-de-teste");
}

describe("clientes Supabase validam o env no primeiro uso", () => {
  it("navegador e servidor falham com EnvError sem variáveis", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => createBrowserSupabase()).toThrow(EnvError);
    await expect(createServerSupabase()).rejects.toBeInstanceOf(EnvError);
    expect(criarBrowser).not.toHaveBeenCalled();
  });

  it("navegador usa só a chave publicável", () => {
    envCompleto();
    createBrowserSupabase();
    expect(criarBrowser).toHaveBeenCalledWith(URL, "pub");
  });

  it("servidor cria um cliente novo por requisição", async () => {
    envCompleto();
    const a = await createServerSupabase();
    const b = await createServerSupabase();
    expect(criarServidor).toHaveBeenCalledTimes(2);
    expect(criarServidor.mock.calls[0][1]).toBe("pub");
    expect(a).not.toBe(b);
  });

  it("admin exige a chave secreta e não persiste sessão", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(() => createAdminSupabase()).toThrow(EnvError);
    envCompleto();
    createAdminSupabase();
    expect(criarAdmin).toHaveBeenCalledWith(URL, "segredo-de-teste", { auth: { persistSession: false, autoRefreshToken: false } });
  });
});
