// @vitest-environment node
// Tarefa 015: escalada de privilégio, ação direta sem tela e CSRF das Server Actions da administração.
// Verificação estática (sem banco); o comportamento é coberto em tests/unit/admin-actions.test.ts,
// no pgTAP supabase/tests/015_administracao_perfis.test.sql e no e2e tests/e2e/admin.spec.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const acoes = ler("src", "app", "(app)", "admin", "actions.ts");
const formularios = ler("src", "app", "(app)", "admin", "formularios.tsx");
const migration = ler("supabase", "migrations", "20261027170600_administracao_perfis.sql");

/** Corpo de cada função exportada (até a próxima declaração de topo). */
function funcoesExportadas(fonte: string): { nome: string; corpo: string }[] {
  const partes = fonte.split(/\n(?=export async function |function |const |\/\*\*)/);
  return partes
    .map((p) => ({ m: /^export async function (\w+)/.exec(p), corpo: p }))
    .filter((x) => x.m)
    .map((x) => ({ nome: x.m![1], corpo: x.corpo }));
}

describe("Server Actions da administração", () => {
  const fns = funcoesExportadas(acoes);

  it("é um módulo de Server Actions com as três ações", () => {
    expect(acoes.startsWith('"use server";')).toBe(true);
    expect(fns.map((f) => f.nome).sort()).toEqual(["atribuirAoEnsaio", "definirPerfil", "removerDoEnsaio"]);
  });

  it("cada ação exige coordination antes de ler o formulário ou criar o cliente", () => {
    for (const { nome, corpo } of fns) {
      const guarda = corpo.indexOf('await exigirPerfil(["coordination"])');
      expect(guarda, nome).toBeGreaterThan(-1);
      for (const depois of ["form.get(", "lerFormulario(form", "createServerSupabase("]) {
        const i = corpo.indexOf(depois);
        if (i > -1) expect(i, `${nome}: ${depois} antes da guarda`).toBeGreaterThan(guarda);
      }
    }
  });

  it("não usa o cliente com chave secreta nem a variável da chave", () => {
    for (const f of [acoes, formularios]) {
      expect(f).not.toMatch(/server\/admin|createAdminSupabase|SUPABASE_SECRET_KEY|service_role/);
    }
  });

  it("o formulário do navegador não importa nada de servidor", () => {
    expect(formularios.startsWith('"use client";')).toBe(true);
    expect(formularios).not.toMatch(/lib\/data\/server|lib\/auth\/server|next\/headers/);
  });

  it("CSRF: nenhuma origem extra liberada para Server Actions", () => {
    const cfg = ler("next.config.ts");
    expect(cfg).not.toMatch(/allowedOrigins/);
  });
});

describe("RPCs de administração no banco", () => {
  const funcoes = ["admin_set_user_role", "admin_add_trial_member", "admin_remove_trial_member"];

  it.each(funcoes)("%s é SECURITY INVOKER, confere coordination e exige motivo", (nome) => {
    const m = new RegExp(`create or replace function public\\.${nome}\\([\\s\\S]*?\\n\\$\\$;`).exec(migration);
    expect(m, nome).not.toBeNull();
    const corpo = m![0];
    expect(corpo).toMatch(/security invoker/);
    expect(corpo).not.toMatch(/security definer/);
    expect(corpo).toMatch(/if not public\.is_coordination\(\) then/);
    expect(corpo).toMatch(/admin_valid_reason\(p_reason\)/);
  });

  it.each(funcoes)("%s não é executável por anon", (nome) => {
    expect(migration).toMatch(new RegExp(`revoke execute on function public\\.${nome}\\([^)]*\\) from public, anon;`));
  });

  it("a última coordenação é protegida por gatilho com trava (UPDATE e DELETE)", () => {
    expect(migration).toMatch(/pg_advisory_xact_lock/);
    expect(migration).toMatch(/before update of role on public\.profiles/);
    expect(migration).toMatch(/before delete on public\.profiles/);
  });
});
