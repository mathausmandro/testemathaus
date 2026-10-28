// @vitest-environment node
// Tarefa 017: matriz de rotas por perfil. Para cada página de src/app e cada perfil, a rota que não
// pertence ao perfil é negada no proxy E na própria página (exigirPerfilNaPagina com os perfis da área).
// Server Actions de áreas restritas exigem o mesmo perfil no servidor.
// A RLS (pgTAP, supabase/tests) é a barreira final; aqui se confere a camada do app.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { decidirRota, ehRotaPublica, perfisDaArea, ROTA_AGUARDANDO, ROTA_LOGIN } from "@/lib/auth/routes";
import { DESTINO_PADRAO } from "@/lib/auth/redirect";
import { PERFIS } from "@/lib/data";

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
const rotaDe = (rel: string) =>
  "/" + rel.split("/").slice(0, -1).filter((s) => !/^\(.+\)$/.test(s)).map((s) => s.replace(/^\[.+\]$/, "x")).join("/");

const fontes = arquivos(APP).map((p) => ({ rel: norm(relative(APP, p)), texto: readFileSync(p, "utf8") }));
const paginas = fontes.filter((f) => /(^|\/)page\.tsx?$/.test(f.rel)).map((f) => ({ ...f, rota: rotaDe(f.rel) }));
const protegidas = paginas.filter((p) => !ehRotaPublica(p.rota) && p.rota !== ROTA_AGUARDANDO);

/** Perfis passados a exigirPerfilNaPagina na página (null = qualquer perfil). */
function perfisNaPagina(texto: string): string[] | null {
  const m = /exigirPerfilNaPagina\(([^)]*)\)/.exec(texto);
  if (!m) throw new Error("página sem exigirPerfilNaPagina");
  const args = m[1].trim();
  if (!args) return null;
  return [...args.matchAll(/"(\w+)"/g)].map((x) => x[1]).sort();
}

describe("matriz de acesso das rotas por perfil", () => {
  it("os três perfis do sistema", () => {
    expect([...PERFIS].sort()).toEqual(["coordination", "field", "home_office"]);
  });

  for (const pagina of protegidas) {
    for (const perfil of PERFIS) {
      const permitidos = perfisDaArea(pagina.rota);
      const pertence = !permitidos || permitidos.includes(perfil);
      it(`${pagina.rota} · ${perfil}: ${pertence ? "permitido" : "negado"}`, () => {
        const d = decidirRota(pagina.rota, "", { tipo: "com_perfil", perfil });
        if (pertence) expect(d).toEqual({ tipo: "seguir" });
        else expect(d).toEqual({ tipo: "redirecionar", destino: DESTINO_PADRAO });
      });
    }
  }

  it("cada página restrita exige no servidor exatamente os perfis da área (não depende só do proxy)", () => {
    for (const p of protegidas) {
      const area = perfisDaArea(p.rota);
      expect(perfisNaPagina(p.texto), p.rel).toEqual(area ? [...area].sort() : null);
    }
  });

  it("sem perfil e sem sessão: nenhuma página protegida abre", () => {
    for (const p of protegidas) {
      expect(decidirRota(p.rota, "", { tipo: "sem_perfil" }), p.rota).toEqual({ tipo: "redirecionar", destino: ROTA_AGUARDANDO });
      const anon = decidirRota(p.rota, "", { tipo: "anonimo" });
      expect(anon.tipo === "redirecionar" && anon.destino.startsWith(ROTA_LOGIN), p.rota).toBe(true);
    }
  });

  // Perfis exigidos por cada arquivo de Server Actions das áreas logadas. Arquivo novo precisa entrar aqui.
  const PERFIS_DAS_ACOES: Record<string, string[]> = {
    "(app)/admin/actions.ts": ["coordination"],
    "(app)/ensaios/actions.ts": ["coordination"], // criarEnsaio, usado por /ensaios/novo
  };

  it("Server Actions das áreas logadas exigem no servidor os perfis revisados", () => {
    const acoes = fontes.filter((f) => /(^|\/)actions\.ts$/.test(f.rel) && f.rel.startsWith("(app)/"));
    expect(acoes.map((a) => a.rel).sort()).toEqual(Object.keys(PERFIS_DAS_ACOES).sort());
    for (const a of acoes) {
      const exportadas = (a.texto.match(/export async function \w+/g) ?? []).length;
      const chamadas = [...a.texto.matchAll(/exigirPerfil\(([^)]*)\)/g)].map((x) => [...x[1].matchAll(/"(\w+)"/g)].map((y) => y[1]).sort());
      expect(chamadas.length, a.rel).toBeGreaterThanOrEqual(exportadas);
      for (const c of chamadas) expect(c, a.rel).toEqual(PERFIS_DAS_ACOES[a.rel]);
    }
    expect(perfisDaArea("/ensaios/novo")).toEqual(["coordination"]);
  });
});
