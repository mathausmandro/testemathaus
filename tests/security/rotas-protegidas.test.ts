// @vitest-environment node
// Tarefa 014: nenhuma rota logada fica fora da proteção.
// Varre src/app e confere: proxy cobre cada página; só rotas listadas são públicas; cada página
// protegida chama o helper de servidor; Server Actions e Route Handlers protegidos revalidam.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { decidirRota, ehRotaPublica, ROTAS_PUBLICAS } from "@/lib/auth/routes";
import { config } from "@/proxy";

const RAIZ = process.cwd();
const APP = join(RAIZ, "src", "app");
const norm = (p: string) => p.split(sep).join("/");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else acc.push(p);
  }
  return acc;
}

const todos = arquivos(APP).map((p) => ({ rel: norm(relative(APP, p)), texto: readFileSync(p, "utf8") }));

/** Caminho da URL a partir do arquivo (remove grupos "(x)" e o nome do arquivo). */
function rotaDe(rel: string): string {
  const partes = rel.split("/").slice(0, -1).filter((s) => !/^\(.+\)$/.test(s));
  return "/" + partes.map((s) => s.replace(/^\[\.{3}(.+)\]$/, "x").replace(/^\[(.+)\]$/, "x")).join("/");
}

const paginas = todos.filter((f) => /(^|\/)page\.tsx?$/.test(f.rel)).map((f) => ({ ...f, rota: rotaDe(f.rel) }));
const handlers = todos.filter((f) => /(^|\/)route\.ts$/.test(f.rel)).map((f) => ({ ...f, rota: rotaDe(f.rel) }));
const acoes = todos.filter((f) => /(^|\/)actions\.ts$/.test(f.rel));

// O matcher do proxy segue a sintaxe do path-to-regexp; este só tem um grupo de regex, equivalente a RegExp.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("varredura das rotas", () => {
  it("encontra as páginas do app", () => {
    expect(paginas.map((p) => p.rota).sort()).toEqual(expect.arrayContaining(["/", "/login", "/aguardando", "/inicio", "/admin"]));
  });

  it("toda página e todo Route Handler passam pelo proxy", () => {
    for (const p of [...paginas, ...handlers]) expect(matcher.test(p.rota), p.rota).toBe(true);
  });

  it("o proxy ignora só arquivos estáticos", () => {
    for (const s of ["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico", "/logo.svg", "/fonte.woff2"]) {
      expect(matcher.test(s), s).toBe(false);
    }
    for (const s of ["/admin", "/api/sync", "/inicio/", "/ensaios/1/croqui"]) expect(matcher.test(s), s).toBe(true);
  });

  it("a lista de rotas públicas é exatamente a revisada", () => {
    expect([...ROTAS_PUBLICAS].sort()).toEqual(["/", "/auth/callback", "/login"]);
  });

  it("toda página fora da lista pública exige sessão no proxy", () => {
    for (const p of paginas.filter((x) => !ehRotaPublica(x.rota))) {
      const d = decidirRota(p.rota, "", { tipo: "anonimo" });
      expect(d, p.rota).toMatchObject({ tipo: "redirecionar" });
      expect((d as { destino: string }).destino.startsWith("/login"), p.rota).toBe(true);
    }
  });

  it("nenhuma página de src/app/(app) é pública", () => {
    for (const p of paginas.filter((x) => x.rel.startsWith("(app)/"))) expect(ehRotaPublica(p.rota), p.rota).toBe(false);
  });

  it("toda página de src/app/(app) chama exigirPerfilNaPagina (o proxy não é a única barreira)", () => {
    const faltando = paginas.filter((p) => p.rel.startsWith("(app)/") && !p.texto.includes("exigirPerfilNaPagina(")).map((p) => p.rel);
    expect(faltando).toEqual([]);
  });

  it("a área de administração exige coordination no servidor", () => {
    for (const p of paginas.filter((x) => x.rota === "/admin" || x.rota.startsWith("/admin/"))) {
      expect(p.texto, p.rel).toMatch(/exigirPerfilNaPagina\(\["coordination"\]\)/);
    }
  });

  it("toda página protegida fora de (app) revalida a sessão", () => {
    const outras = paginas.filter((p) => !p.rel.startsWith("(app)/") && !ehRotaPublica(p.rota));
    for (const p of outras) expect(p.texto, p.rel).toMatch(/exigir(PerfilNaPagina|SessaoSemPerfilNaPagina)\(/);
  });

  it("Server Actions e Route Handlers protegidos revalidam sessão e perfil", () => {
    const publicos = new Set(["(auth)/login/actions.ts", "(auth)/actions.ts", "auth/callback/route.ts"]);
    const protegidos = [...acoes, ...handlers].filter((f) => !publicos.has(f.rel));
    for (const f of protegidos) expect(f.texto, f.rel).toMatch(/exigir(Sessao|Perfil)\(/);
    // As exceções são justamente as que obtêm ou encerram a sessão.
    expect([...acoes, ...handlers].map((f) => f.rel).filter((r) => publicos.has(r)).sort()).toEqual([...publicos].sort());
  });

  it("o e2e sem sessão lista todas as páginas protegidas", () => {
    const e2e = readFileSync(join(RAIZ, "tests", "e2e", "rotas-protegidas.spec.ts"), "utf8");
    for (const p of paginas.filter((x) => !ehRotaPublica(x.rota))) expect(e2e, p.rota).toContain(`"${p.rota}"`);
  });

  it("a sessão do servidor é lida em tempo de requisição (não congela no build)", () => {
    const sessao = readFileSync(join(RAIZ, "src", "lib", "data", "server", "session.ts"), "utf8");
    expect(sessao).toMatch(/await connection\(\);/);
    expect(sessao).toMatch(/auth\.getUser\(\)/);
  });
});
