// @vitest-environment node
// Tarefa 013: verificação estática do hook de domínio (o comportamento é testado no pgTAP,
// supabase/tests/013_hook_dominio_email.test.sql, que requer Supabase local).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { montarRequisicao, normalizarDominio } from "../../scripts/set-allowed-email-domain.mjs";

const root = join(__dirname, "..", "..");
const migDir = join(root, "supabase", "migrations");
const migracao = readdirSync(migDir).find((f) => f.endsWith("_hook_dominio_email.sql"))!;
const sql = readFileSync(join(migDir, migracao), "utf8");
const toml = readFileSync(join(root, "supabase", "config.toml"), "utf8");
const pgtap = readFileSync(join(root, "supabase", "tests", "013_hook_dominio_email.test.sql"), "utf8");

describe("hook before_user_created", () => {
  it("está habilitado no config.toml apontando para a função da migration", () => {
    const bloco = toml.split("[auth.hook.before_user_created]")[1]?.split(/\n\[/)[0] ?? "";
    expect(bloco).toMatch(/^enabled = true$/m);
    expect(bloco).toMatch(/^uri = "pg-functions:\/\/postgres\/public\/hook_before_user_created"$/m);
    expect(sql).toMatch(/create or replace function public\.hook_before_user_created\(event jsonb\)/);
  });

  it("EXECUTE só para supabase_auth_admin; search_path fixo", () => {
    expect(sql).toMatch(
      /revoke execute on function public\.hook_before_user_created\(jsonb\) from public, anon, authenticated, service_role;/,
    );
    expect(sql).toMatch(/grant execute on function public\.hook_before_user_created\(jsonb\) to supabase_auth_admin;/);
    expect(sql).toMatch(/grant execute on function public\.set_auth_email_domain\(text\) to service_role;/);
    expect(sql).not.toMatch(/grant execute on function public\.set_auth_email_domain\(text\) to (anon|authenticated)/);
  });

  it("nenhum domínio fixo na migration além do reservado exemplo.test", () => {
    const dominios = [...sql.matchAll(/'[^'\s]*@?([a-z0-9-]+\.)+[a-z]{2,}'/gi)].map((m) => m[0]);
    expect(dominios.filter((d) => d !== "'exemplo.test'")).toEqual([]);
    expect(sql).not.toMatch(/insert into app_private\.auth_settings \([^)]*allowed_email_domain/);
  });

  it("o pgTAP cobre aceitos, recusados, configuração ausente e claims", () => {
    for (const caso of ["sem domínio configurado: recusa", "recusa subdomínio", "recusa duplo @", "aceita sem diferença de maiúsculas", "xms_edov falso: recusa", "authenticated não consegue chamar o hook"]) {
      expect(pgtap).toContain(caso);
    }
  });

  it("o seed só liga o modo local, sem domínio", () => {
    const seed = readFileSync(join(root, "supabase", "seed.sql"), "utf8");
    expect(seed).toContain("update app_private.auth_settings set local_test_mode = true;");
    expect(seed).not.toMatch(/allowed_email_domain\s*=/);
  });
});

describe("scripts/set-allowed-email-domain.mjs", () => {
  it("normaliza o domínio", () => {
    expect(normalizarDominio("  @Empresa-Ficticia.TEST ")).toBe("empresa-ficticia.test");
    expect(normalizarDominio("")).toBeNull();
    expect(normalizarDominio(undefined)).toBeNull();
  });

  it.each(["empresa", "empresa..test", "a b.test", "a@b.test", "-empresa.test", "empresa.test/x"])("recusa %j", (d) => {
    expect(() => normalizarDominio(d)).toThrow(/inválido/);
  });

  it("chama a RPC com a chave só no cabeçalho apikey", () => {
    const { endpoint, init } = montarRequisicao({ url: "http://127.0.0.1:54321", chave: "chave-ficticia", dominio: "empresa-ficticia.test" });
    expect(endpoint).toBe("http://127.0.0.1:54321/rest/v1/rpc/set_auth_email_domain");
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe("chave-ficticia");
    expect(JSON.parse(init.body)).toEqual({ p_domain: "empresa-ficticia.test" });
  });
});
