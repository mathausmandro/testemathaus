// @vitest-environment node
// Tarefa 017 (S2 da 001): toda página, pública ou logada, responde com todos os cabeçalhos de segurança.
// Simula cada rota de src/app em cada situação de sessão (anônimo, sem perfil, cada perfil, erro):
// passa pelo proxy real (CSP com nonce) e soma os cabeçalhos fixos do next.config.ts (build de produção).
// A conferência na resposta HTTP real fica no e2e tests/e2e/seguranca.spec.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ atualizar: vi.fn() }));
vi.mock("@/lib/data/proxy-session", () => ({ atualizarSessaoNoProxy: m.atualizar }));

import { proxy } from "@/proxy";

// Lista fixa de propósito: se alguém tirar um cabeçalho do código, este teste reprova.
const OBRIGATORIOS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
  "strict-transport-security",
];

const APP = join(process.cwd(), "src", "app");
const norm = (p: string) => p.split(sep).join("/");
function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else acc.push(p);
  }
  return acc;
}
const rotas = arquivos(APP)
  .map((p) => norm(relative(APP, p)))
  .filter((r) => /(^|\/)(page\.tsx?|route\.ts)$/.test(r))
  .map((r) => "/" + r.split("/").slice(0, -1).filter((s) => !/^\(.+\)$/.test(s)).map((s) => s.replace(/^\[.+\]$/, "00000000-0000-4000-8000-000000000000")).join("/"));

const SITUACOES = [
  { tipo: "anonimo" },
  { tipo: "sem_perfil" },
  { tipo: "com_perfil", perfil: "coordination" },
  { tipo: "com_perfil", perfil: "field" },
  { tipo: "com_perfil", perfil: "home_office" },
  { tipo: "erro" },
] as const;

let fixos: { key: string; value: string }[] = [];

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projeto-ficticio.supabase.test");
  const cfg = (await import("../../next.config")).default;
  const regras = await cfg.headers!();
  // Uma regra para todos os caminhos: nenhuma página escapa dos cabeçalhos fixos.
  expect(regras.map((r) => r.source)).toEqual(["/:path*"]);
  fixos = regras[0].headers;
});
afterAll(() => vi.unstubAllEnvs());

async function respostaDe(rota: string, estado: (typeof SITUACOES)[number]): Promise<Headers> {
  m.atualizar.mockImplementation(async (r: NextRequest) => ({ estado, response: NextResponse.next({ request: r }) }));
  const r = await proxy(new NextRequest(`https://app.exemplo.test${rota}`));
  const h = new Headers(r.headers);
  for (const { key, value } of fixos) if (!h.has(key)) h.set(key, value);
  return h;
}

describe("cabeçalhos de segurança em todas as rotas", () => {
  it("encontra as rotas públicas e logadas", () => {
    expect(rotas).toEqual(expect.arrayContaining(["/", "/login", "/aguardando", "/inicio", "/admin", "/ensaios", "/auth/callback"]));
  });

  for (const rota of rotas) {
    it(`${rota}: todos os cabeçalhos, em toda situação de sessão`, async () => {
      for (const estado of SITUACOES) {
        const h = await respostaDe(rota, estado);
        for (const nome of OBRIGATORIOS) expect(h.get(nome), `${rota} ${JSON.stringify(estado)} ${nome}`).toBeTruthy();
      }
    });
  }

  it("valores: CSP estrita de produção, HSTS longo, sem iframe", async () => {
    const h = await respostaDe("/inicio", { tipo: "com_perfil", perfil: "field" });
    const csp = h.get("content-security-policy")!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'(;|$)/);
    expect(csp).not.toMatch(/unsafe-eval|unsafe-inline|\*/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://projeto-ficticio.supabase.test wss://projeto-ficticio.supabase.test;");
    expect(h.get("strict-transport-security")).toMatch(/max-age=(\d+)/);
    expect(Number(/max-age=(\d+)/.exec(h.get("strict-transport-security")!)![1])).toBeGreaterThanOrEqual(31536000);
    expect(h.get("x-frame-options")).toBe("DENY");
    expect(h.get("x-content-type-options")).toBe("nosniff");
    expect(h.get("permissions-policy")).toMatch(/camera=\(self\).*geolocation=\(self\)/);
  });

  it("o next.config não liga cabeçalho que enfraquece (CORS aberto, powered-by)", async () => {
    expect(fixos.map((f) => f.key.toLowerCase())).not.toContain("access-control-allow-origin");
    const cfg = (await import("../../next.config")).default;
    expect(cfg.poweredByHeader).toBe(false);
  });

  it("o proxy aplica a CSP em todo caminho de saída (seguir e redirecionar)", () => {
    const fonte = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
    const corpo = fonte.slice(fonte.indexOf("export async function proxy"), fonte.indexOf("export const config"));
    const retornos = corpo.match(/return [^;]+;/g) ?? [];
    expect(retornos.length).toBeGreaterThanOrEqual(3);
    for (const r of retornos) expect(r, r).toMatch(/^return comCsp\(/);
  });
});
