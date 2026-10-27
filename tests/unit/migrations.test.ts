// @vitest-environment node
/**
 * Validação estática das migrations (sem banco): sintaxe pelo parser real do Postgres 17
 * (libpg-query em WASM), nomes no formato do Supabase CLI, RLS ligada em toda tabela,
 * nenhuma política permissiva genérica e search_path fixo em funções security definer.
 * Corpos PL/pgSQL não são validados por este parser; só os de LANGUAGE sql.
 * A validação real continua sendo `supabase db reset` + `supabase test db` (requer Docker).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadModule, parseSync } from "libpg-query";
import { Constants } from "../../src/lib/data/database.types";

const root = join(__dirname, "..", "..");
const migDir = join(root, "supabase", "migrations");
const testDir = join(root, "supabase", "tests");
const migFiles = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
const testFiles = readdirSync(testDir).filter((f) => f.endsWith(".sql")).sort();
const read = (dir: string, f: string) => readFileSync(join(dir, f), "utf8");
const allMigrations = migFiles.map((f) => read(migDir, f)).join("\n");

type Stmt = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const stmtsOf = (sql: string): Stmt[] => parseSync(sql).stmts.map((s: { stmt: Stmt }) => s.stmt);

beforeAll(async () => {
  await loadModule();
});

describe("migrations: arquivos", () => {
  it("existem e seguem o formato timestamp_nome.sql do CLI, em ordem crescente e sem repetição", () => {
    expect(migFiles.length).toBeGreaterThan(0);
    const stamps = migFiles.map((f) => {
      expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
      return f.slice(0, 14);
    });
    expect(new Set(stamps).size).toBe(stamps.length);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it("marcam que não foram executadas aqui (requer Docker/Supabase local)", () => {
    for (const f of migFiles) expect(read(migDir, f)).toMatch(/NÃO EXECUTADO: requer Docker\/Supabase local/);
  });
});

describe("migrations: sintaxe (parser do Postgres 17)", () => {
  it.each(migFiles)("%s é SQL válido", (f) => {
    expect(() => stmtsOf(read(migDir, f))).not.toThrow();
  });

  it.each(testFiles)("teste pgTAP %s é SQL válido", (f) => {
    expect(() => stmtsOf(read(testDir, f))).not.toThrow();
  });

  it("seed.sql é SQL válido", () => {
    expect(() => stmtsOf(read(join(root, "supabase"), "seed.sql"))).not.toThrow();
  });

  it("corpos de funções LANGUAGE sql são SQL válido", () => {
    for (const f of migFiles) {
      for (const s of stmtsOf(read(migDir, f))) {
        const fn = s.CreateFunctionStmt;
        if (!fn) continue;
        const opt = (name: string) => fn.options.find((o: Stmt) => o.DefElem.defname === name)?.DefElem;
        if (opt("language")?.arg.String.sval !== "sql") continue;
        const body = opt("as").arg.List.items[0].String.sval as string;
        expect(() => parseSync(body), `${f}: corpo de função sql`).not.toThrow();
      }
    }
  });
});

describe("migrations: regras de segurança", () => {
  const stmts = migFiles.flatMap((f) => stmtsOf(read(migDir, f)));
  const tables = stmts
    .filter((s) => s.CreateStmt?.relation.schemaname === "public")
    .map((s) => s.CreateStmt.relation.relname as string);

  it("toda tabela do schema public tem RLS ligada", () => {
    expect(tables.length).toBeGreaterThan(0);
    const withRls = new Set(
      stmts
        .filter((s) =>
          s.AlterTableStmt?.cmds?.some((c: Stmt) => c.AlterTableCmd.subtype === "AT_EnableRowSecurity"),
        )
        .map((s) => s.AlterTableStmt.relation.relname),
    );
    for (const t of tables) expect(withRls.has(t), `RLS em ${t}`).toBe(true);
  });

  it("nenhuma política usa using (true) ou with check (true)", () => {
    expect(allMigrations).not.toMatch(/(using|with\s+check)\s*\(\s*true\s*\)/i);
  });

  it("toda função security definer fixa o search_path", () => {
    for (const s of stmts) {
      const fn = s.CreateFunctionStmt;
      if (!fn) continue;
      const defs = fn.options.map((o: Stmt) => o.DefElem);
      const secdef = defs.some((d: Stmt) => d.defname === "security" && d.arg.Boolean?.boolval);
      if (!secdef) continue;
      const name = fn.funcname.map((n: Stmt) => n.String.sval).join(".");
      const sp = defs.some((d: Stmt) => d.defname === "set" && d.arg.VariableSetStmt?.name === "search_path");
      expect(sp, `search_path em ${name}`).toBe(true);
    }
  });

  it("change_history não tem política de UPDATE nem DELETE", () => {
    const policies = stmts.filter((s) => s.CreatePolicyStmt?.table.relname === "change_history");
    // Só leitura por política; a inclusão é feita exclusivamente pelos gatilhos (security definer).
    for (const p of policies) expect(p.CreatePolicyStmt.cmd_name).toBe("select");
  });

  it("tabelas de campo não têm política de DELETE", () => {
    const campo = ["field_records", "field_record_photos", "applications", "occurrences", "quality_flags"];
    const del = stmts.filter(
      (s) => campo.includes(s.CreatePolicyStmt?.table.relname) && ["delete", "all"].includes(s.CreatePolicyStmt.cmd_name),
    );
    expect(del).toEqual([]);
  });

  it("colunas de data/hora usam timestamptz (timestamp sem fuso é proibido)", () => {
    expect(allMigrations).not.toMatch(/\btimestamp\b(?!tz)(?!\s+with\s+time\s+zone)/i);
  });
});

describe("database.types.ts coerente com as migrations", () => {
  const typesSrc = readFileSync(join(root, "src", "lib", "data", "database.types.ts"), "utf8");
  const stmts = migFiles.flatMap((f) => stmtsOf(read(migDir, f)));

  it("tem uma entrada em Tables para cada tabela criada", () => {
    const tables = stmts
      .filter((s) => s.CreateStmt?.relation.schemaname === "public")
      .map((s) => s.CreateStmt.relation.relname as string);
    for (const t of tables) expect(typesSrc, `tipo de ${t}`).toMatch(new RegExp(`\\n {6}${t}: \\{\\n {8}Row: \\{`));
  });

  it("Constants.public.Enums tem os mesmos valores dos enums do banco", () => {
    const enums = Object.fromEntries(
      stmts
        .filter((s) => s.CreateEnumStmt)
        .map((s) => [
          s.CreateEnumStmt.typeName.at(-1).String.sval,
          s.CreateEnumStmt.vals.map((v: Stmt) => v.String.sval),
        ]),
    );
    expect(Constants.public.Enums).toEqual(enums);
  });
});
