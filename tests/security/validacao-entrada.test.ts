// @vitest-environment node
// Tarefa 017: validação de entrada centralizada. Varre src/app e cobra, em toda Server Action
// ("use server") e todo Route Handler (route.ts):
// - a entrada passa pelo utilitário compartilhado src/lib/validation (zod), nunca lida "na mão";
// - toda função exportada que recebe argumentos chama validarEntrada/validarFormulario
//   (direto ou por um auxiliar local que as chama);
// - nenhuma resposta devolve mensagem, stack ou causa de erro interno.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(process.cwd(), "src", "app");
const norm = (p: string) => p.split(sep).join("/");
function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(p);
  }
  return acc;
}

type Funcao = { nome: string; params: string; corpo: string; exportada: boolean };

/** Funções de topo (declaração `function` ou `async function`) com parâmetros e corpo. */
export function funcoes(fonte: string): Funcao[] {
  const re = /^(export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/gm;
  const achadas = [...fonte.matchAll(re)];
  return achadas.map((m, i) => ({
    nome: m[2],
    params: m[3].trim(),
    exportada: Boolean(m[1]),
    corpo: fonte.slice(m.index!, achadas[i + 1]?.index ?? fonte.length),
  }));
}

const VALIDADORES = ["validarEntrada(", "validarFormulario("];

/** Funções exportadas com argumentos que não validam a entrada. */
export function semValidacao(fonte: string): string[] {
  const fs = funcoes(fonte);
  const auxiliares = fs.filter((f) => !f.exportada && VALIDADORES.some((v) => f.corpo.includes(v))).map((f) => `${f.nome}(`);
  const aceitos = [...VALIDADORES, ...auxiliares];
  return fs.filter((f) => f.exportada && f.params !== "" && !aceitos.some((a) => f.corpo.includes(a))).map((f) => f.nome);
}

const ehUseServer = (t: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(t);

const fontes = arquivos(APP).map((p) => ({ rel: norm(relative(APP, p)), texto: readFileSync(p, "utf8") }));
const alvos = fontes.filter((f) => ehUseServer(f.texto) || /(^|\/)route\.ts$/.test(f.rel));

describe("validação de entrada em Server Actions e Route Handlers", () => {
  it("encontra as ações e rotas do app", () => {
    expect(alvos.map((a) => a.rel)).toEqual(
      expect.arrayContaining(["(app)/admin/actions.ts", "(app)/ensaios/actions.ts", "(auth)/login/actions.ts", "auth/callback/route.ts"]),
    );
  });

  it("\"use server\" só em arquivos actions.ts (nada de ação inline escondida em componente)", () => {
    const inline = fontes.filter((f) => !/(^|\/)actions\.ts$/.test(f.rel) && /["']use server["']/.test(f.texto)).map((f) => f.rel);
    expect(inline).toEqual([]);
  });

  it("toda função exportada que recebe entrada valida com o utilitário compartilhado", () => {
    const faltando = alvos.flatMap((a) => semValidacao(a.texto).map((n) => `${a.rel}: ${n}`));
    expect(faltando).toEqual([]);
  });

  it("quem recebe entrada importa src/lib/validation e não lê FormData/query direto", () => {
    for (const a of alvos.filter((x) => funcoes(x.texto).some((f) => f.exportada && f.params !== ""))) {
      expect(a.texto, a.rel).toMatch(/from "@\/lib\/validation"/);
      expect(a.texto, a.rel).not.toMatch(/\b(form|formData|searchParams|params)\.(get|getAll)\(/);
      expect(a.texto, a.rel).not.toMatch(/request\.(json|formData|text)\(\)/);
    }
  });

  it("nenhuma resposta devolve mensagem, stack ou causa de erro", () => {
    for (const a of alvos) {
      expect(a.texto, a.rel).not.toMatch(/\b(e|err|erro|error)\.(message|stack|cause)\b/);
      expect(a.texto, a.rel).not.toMatch(/JSON\.stringify\((e|err|erro|error)\)/);
    }
  });

  it("detector: acusa função exportada sem validação e aceita auxiliar local", () => {
    const ruim = `"use server";\nexport async function salvar(form: FormData) {\n  const x = form.get("a");\n}\n`;
    const bom = `"use server";\nfunction ler(f: FormData) {\n  return validarEntrada(s, lerFormulario(f, ["a"]));\n}\nexport async function salvar(form: FormData) {\n  ler(form);\n}\nexport async function sair() {}\n`;
    expect(semValidacao(ruim)).toEqual(["salvar"]);
    expect(semValidacao(bom)).toEqual([]);
  });
});
