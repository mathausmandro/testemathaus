// @vitest-environment node
// S6 (docs/seguranca/001.md): dados de ensaio, perfil ou campo nunca em `use cache` compartilhado.
// Com cacheComponents, "use cache" (e "use cache: remote") guarda o resultado sem a identidade do usuário
// na chave: a resposta de um usuário poderia ser servida a outro, sem passar de novo pela RLS.
// Regra: arquivo que importa src/lib/data (ou está nele) não usa "use cache"/"use cache: remote".
// Só "use cache: private" (por usuário) é aceito. Regra também na skill nextjs-app-router.
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

/** Diretiva de cache compartilhado (qualquer posição: arquivo, função ou componente). */
export function usaCacheCompartilhado(texto: string): boolean {
  return /["']use cache(?::\s*remote)?["']/.test(texto);
}

/** Importa a camada de dados por alias ou caminho relativo. */
export function importaCamadaDeDados(rel: string, texto: string): boolean {
  if (rel.startsWith("src/lib/data/")) return true;
  const imports = [...texto.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map((m) => m[1]);
  return imports.some((i) => i === "@/lib/data" || i.startsWith("@/lib/data/") || /(^|\/)(lib\/)?data(\/|$)/.test(i.replace(/^(\.\.?\/)+/, "")));
}

const fontes = arquivos(join(RAIZ, "src")).map((p) => ({ rel: norm(relative(RAIZ, p)), texto: readFileSync(p, "utf8") }));

describe("use cache e dados de ensaio (S6)", () => {
  it("encontra arquivos que usam a camada de dados", () => {
    expect(fontes.filter((f) => importaCamadaDeDados(f.rel, f.texto)).length).toBeGreaterThan(5);
  });

  it("nenhum arquivo que importa src/lib/data usa use cache compartilhado", () => {
    const infratores = fontes.filter((f) => importaCamadaDeDados(f.rel, f.texto) && usaCacheCompartilhado(f.texto)).map((f) => f.rel);
    expect(infratores).toEqual([]);
  });

  it("detector: pega as variantes compartilhadas e aceita a privada", () => {
    expect(usaCacheCompartilhado('"use cache";')).toBe(true);
    expect(usaCacheCompartilhado("  'use cache: remote'")).toBe(true);
    expect(usaCacheCompartilhado('"use cache: private"')).toBe(false);
    expect(importaCamadaDeDados("src/app/x/page.tsx", 'import { listTrials } from "@/lib/data/trials";')).toBe(true);
    expect(importaCamadaDeDados("src/lib/auth/server.ts", 'import { obterSessao } from "../data/server/session";')).toBe(true);
    expect(importaCamadaDeDados("src/app/x/page.tsx", 'import Link from "next/link";')).toBe(false);
  });
});
