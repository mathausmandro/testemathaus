// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { criarServidor, trocar } = vi.hoisted(() => ({ criarServidor: vi.fn(), trocar: vi.fn() }));
vi.mock("@/lib/data/server/server-client", () => ({ createServerSupabase: criarServidor }));
vi.mock("@/lib/data/auth", () => ({ trocarCodigoPorSessao: trocar }));

import { GET } from "@/app/auth/callback/route";

const BASE = "http://localhost:3000";
const req = (qs: string) => new NextRequest(`${BASE}/auth/callback${qs}`);

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /auth/callback", () => {
  it("troca o código e redireciona para o next interno", async () => {
    criarServidor.mockResolvedValue({});
    trocar.mockResolvedValue(undefined);
    const r = await GET(req("?code=abc&next=%2Fensaios%2F1"));
    expect(trocar).toHaveBeenCalledWith({}, "abc");
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`${BASE}/ensaios/1`);
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
  });

  it.each(["https://outro-site.example", "//outro-site.example", "/\\outro-site.example", "javascript:alert(1)"])(
    "rejeita retorno externo %s (vai para o destino padrão do próprio site)",
    async (next) => {
      criarServidor.mockResolvedValue({});
      trocar.mockResolvedValue(undefined);
      const r = await GET(req(`?code=abc&next=${encodeURIComponent(next)}`));
      const destino = new URL(r.headers.get("location")!);
      expect(destino.origin).toBe(BASE);
      expect(destino.pathname).toBe("/inicio");
    },
  );

  it("sem código: volta ao login sem tocar no Supabase", async () => {
    const r = await GET(req("?next=https://outro-site.example"));
    expect(new URL(r.headers.get("location")!).toString()).toBe(`${BASE}/login?erro=callback`);
    expect(criarServidor).not.toHaveBeenCalled();
  });

  it("erro do provedor ou do hook: mensagem fixa, sem refletir a descrição", async () => {
    const r = await GET(req("?error=access_denied&error_description=%3Cscript%3E"));
    const loc = r.headers.get("location")!;
    expect(loc).toBe(`${BASE}/login?erro=provedor`);
    expect(loc).not.toContain("script");
  });

  it("falha na troca do código (ou env ausente) volta ao login", async () => {
    criarServidor.mockRejectedValue(new Error("env"));
    const r = await GET(req("?code=abc"));
    expect(r.headers.get("location")).toBe(`${BASE}/login?erro=callback`);
  });

  it("usa SITE_URL como origem quando definida", async () => {
    vi.stubEnv("SITE_URL", "https://app.exemplo.test");
    const r = await GET(req("?error=x"));
    expect(r.headers.get("location")).toBe("https://app.exemplo.test/login?erro=provedor");
  });
});
