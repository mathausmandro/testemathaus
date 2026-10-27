// Achado G3 (tarefa 002/017): a chave secreta e o cliente admin ficam isolados no servidor.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const norm = (p: string) => p.split(sep).join("/");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(nome)) acc.push(p);
  }
  return acc;
}

const fontes = arquivos(join(RAIZ, "src")).map((p) => ({ rel: norm(relative(RAIZ, p)), texto: readFileSync(p, "utf8") }));

const ehUseClient = (t: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(t);
const noServidorDeDados = (rel: string) => rel.startsWith("src/lib/data/server/");
// Único módulo fora de data/server que pode citar a variável: valida o env e é protegido por "server-only".
const LEITOR_DE_ENV = "src/lib/env.server.ts";

describe("isolamento da chave secreta", () => {
  it("encontra arquivos para varrer", () => {
    expect(fontes.length).toBeGreaterThan(3);
    expect(fontes.some((f) => f.rel === "src/lib/data/server/admin.ts")).toBe(true);
  });

  it("SUPABASE_SECRET_KEY só aparece em src/lib/data/server e em env.server.ts", () => {
    const infratores = fontes.filter((f) => f.texto.includes("SUPABASE_SECRET_KEY") && !noServidorDeDados(f.rel) && f.rel !== LEITOR_DE_ENV);
    expect(infratores.map((f) => f.rel)).toEqual([]);
  });

  it("nenhum arquivo com \"use client\" cita a chave secreta, o cliente admin ou env.server", () => {
    const infratores = fontes.filter(
      (f) => ehUseClient(f.texto) && /SUPABASE_SECRET_KEY|createAdminSupabase|data\/server|env\.server|SERVICE_ROLE/.test(f.texto),
    );
    expect(infratores.map((f) => f.rel)).toEqual([]);
  });

  it("o cliente admin só é importado dentro de src/lib/data/server", () => {
    const infratores = fontes.filter(
      (f) => !noServidorDeDados(f.rel) && /createAdminSupabase|data\/server\/admin|\.\/admin["']/.test(f.texto),
    );
    expect(infratores.map((f) => f.rel)).toEqual([]);
  });

  it("nenhuma variável NEXT_PUBLIC_* carrega segredo", () => {
    const infratores = fontes.filter((f) => /NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE|PRIVATE)/.test(f.texto));
    expect(infratores.map((f) => f.rel)).toEqual([]);
  });

  it("os módulos do admin e do servidor importam server-only", () => {
    for (const f of fontes.filter((f) => noServidorDeDados(f.rel))) expect(f.texto, f.rel).toContain('import "server-only"');
  });

  it("detecta a violação (o detector funciona)", () => {
    expect(ehUseClient('"use client";\nimport x from "@/lib/data/server/admin";')).toBe(true);
    expect(ehUseClient('import "server-only";')).toBe(false);
  });
});
