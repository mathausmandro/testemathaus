// Verifica pré-requisitos do ambiente local: npm run doctor. Tarefa 019.
// Confere versões (node, docker, supabase), portas livres e presença do .env.local.
// Nunca imprime valores de variáveis; só nomes ausentes.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";

/** Portas padrão do Supabase local (supabase/config.toml) e do app. */
export const PORTAS = [
  { porta: 3000, nome: "app (Next.js)" },
  { porta: 54321, nome: "Supabase API" },
  { porta: 54322, nome: "Supabase banco" },
  { porta: 54323, nome: "Supabase Studio" },
  { porta: 54324, nome: "Supabase e-mail de desenvolvimento" },
];

/** Variáveis exigidas no .env.local. */
export const VARIAVEIS_OBRIGATORIAS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];

/** Extrai [maior, menor, patch] de um texto como "v24.22.1" ou "Docker version 27.1.0, build x". */
export function extrairVersao(texto) {
  const m = String(texto ?? "").match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

/** Node precisa ser 24 ou superior. */
export function avaliarNode(texto) {
  const v = extrairVersao(texto);
  if (!v) return { ok: false, detalhe: "versão não identificada" };
  return v[0] >= 24 ? { ok: true, detalhe: v.join(".") } : { ok: false, detalhe: `${v.join(".")} (precisa 24 ou superior)` };
}

/** Nomes (não valores) das variáveis ausentes ou vazias no conteúdo de um .env. */
export function variaveisAusentes(conteudo, obrigatorias = VARIAVEIS_OBRIGATORIAS) {
  const definidas = new Set();
  for (const linha of String(conteudo).split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim() !== "") definidas.add(m[1]);
  }
  return obrigatorias.filter((n) => !definidas.has(n));
}

function portaLivre(porta) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(porta, "127.0.0.1");
  });
}

function versaoDe(cmd, args) {
  const isWin = process.platform === "win32";
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: isWin });
  return r.status === 0 ? `${r.stdout}${r.stderr}`.trim() : null;
}

/**
 * Roda todas as checagens. Dependências injetáveis para teste.
 * @returns {Promise<{ nome: string, ok: boolean, aviso?: boolean, detalhe: string }[]>}
 */
export async function diagnosticar(dep = {}) {
  const versao = dep.versao ?? versaoDe;
  const livre = dep.portaLivre ?? portaLivre;
  const existe = dep.existe ?? existsSync;
  const ler = dep.ler ?? ((p) => readFileSync(p, "utf8"));
  const nodeTxt = dep.nodeVersion ?? process.version;
  const itens = [];

  const n = avaliarNode(nodeTxt);
  itens.push({ nome: "Node.js", ok: n.ok, detalhe: n.detalhe });

  const docker = versao("docker", ["--version"]);
  itens.push({ nome: "Docker", ok: Boolean(docker), detalhe: docker ? (extrairVersao(docker)?.join(".") ?? "ok") : "não encontrado (instale o Docker Desktop)" });
  if (docker) {
    const rodando = versao("docker", ["info", "--format", "{{.ServerVersion}}"]);
    itens.push({ nome: "Docker em execução", ok: Boolean(rodando), detalhe: rodando ? "sim" : "parado (abra o Docker Desktop)" });
  }

  const sup = versao("npx", ["supabase", "--version"]);
  itens.push({ nome: "Supabase CLI", ok: Boolean(sup), detalhe: sup ? (extrairVersao(sup)?.join(".") ?? "ok") : "não encontrada (rode npm ci)" });

  for (const { porta, nome } of PORTAS) {
    const l = await livre(porta);
    itens.push({ nome: `Porta ${porta}`, ok: true, aviso: !l, detalhe: l ? `livre (${nome})` : `em uso (${nome}); normal se o Supabase/app já estiver rodando` });
  }

  if (!existe(".env.local")) {
    itens.push({ nome: ".env.local", ok: false, detalhe: "ausente (rode npm run setup:local depois de supabase start)" });
  } else {
    const faltam = variaveisAusentes(ler(".env.local"));
    itens.push({ nome: ".env.local", ok: faltam.length === 0, detalhe: faltam.length ? `faltam: ${faltam.join(", ")}` : "presente e completo" });
  }
  return itens;
}

export function formatar(itens) {
  return itens.map((i) => `${i.ok ? (i.aviso ? "AVISO " : "OK    ") : "FALHOU"} ${i.nome}: ${i.detalhe}`).join("\n");
}

async function main() {
  const itens = await diagnosticar();
  console.log(formatar(itens));
  const falhas = itens.filter((i) => !i.ok).length;
  console.log(falhas ? `\n${falhas} pendência(s). Veja a seção de solução de problemas do README.` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
