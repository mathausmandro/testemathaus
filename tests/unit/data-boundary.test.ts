// Fronteira da camada de dados e tipos em dia com as migrations.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(p);
  }
  return acc;
}

describe("Supabase só em src/lib/data", () => {
  it("nenhum arquivo fora de src/lib/data importa @supabase/*", () => {
    const infratores = arquivos(join(RAIZ, "src"))
      .map((p) => relative(RAIZ, p).split(sep).join("/"))
      .filter((rel) => !rel.startsWith("src/lib/data/"))
      .filter((rel) => /from\s+["']@supabase\//.test(readFileSync(join(RAIZ, rel), "utf8")));
    expect(infratores).toEqual([]);
  });

  it("o eslint proíbe @supabase/* fora de src/lib/data", () => {
    const cfg = readFileSync(join(RAIZ, "eslint.config.mjs"), "utf8");
    expect(cfg).toContain("no-restricted-imports");
    expect(cfg).toContain("@supabase/*");
    expect(cfg).toContain('ignores: ["src/lib/data/**"]');
  });
});

describe("database.types.ts × migrations", () => {
  const sql = readdirSync(join(RAIZ, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(RAIZ, "supabase/migrations", f), "utf8"))
    .join("\n");
  const tipos = readFileSync(join(RAIZ, "src/lib/data/database.types.ts"), "utf8");

  it("toda tabela criada nas migrations existe nos tipos", () => {
    const tabelas = [...sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)].map((m) => m[1]);
    expect(tabelas.length).toBeGreaterThan(10);
    const faltando = tabelas.filter((t) => !new RegExp(`^      ${t}: \\{$`, "m").test(tipos));
    expect(faltando).toEqual([]);
  });

  it("os enums das migrations existem nos tipos", () => {
    const enums = [...sql.matchAll(/create type public\.([a-z_]+) as enum/gi)].map((m) => m[1]);
    const faltando = enums.filter((e) => !new RegExp(`^      ${e}:`, "m").test(tipos));
    expect(faltando).toEqual([]);
  });

  it("package.json tem o script gen:types", () => {
    const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
    expect(pkg.scripts["gen:types"]).toContain("supabase gen types typescript");
  });
});
