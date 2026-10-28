// Preparação local em um comando (QA A3, tarefa 019): npm run setup
// Encadeia: 1) doctor (pré-requisitos) → 2) setup:local (gera .env.local, se ainda não existir) →
// 3) orientações dos próximos passos.
// NÃO roda nada destrutivo: não faz `supabase db reset`, não sobrescreve .env.local (sem --force),
// não liga nem desliga containers. Nenhum valor de variável é impresso.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { diagnosticar, formatar } from "./doctor.mjs";

/**
 * Itens do doctor que são pré-requisito (o .env.local é justamente o que este script cria).
 * @template {{ nome: string, ok: boolean }} T
 * @param {T[]} itens
 * @returns {T[]}
 */
export function prerequisitos(itens) {
  return itens.filter((i) => i.nome !== ".env.local");
}

/**
 * Decide os passos sem executar nada (testável).
 * @param {{ itens: { nome: string, ok: boolean }[], envLocalExiste: boolean }} estado
 * @returns {{ prosseguir: boolean, gerarEnvLocal: boolean, falhas: string[] }}
 */
export function planejar({ itens, envLocalExiste }) {
  const falhas = prerequisitos(itens).filter((i) => !i.ok).map((i) => i.nome);
  return { prosseguir: falhas.length === 0, gerarEnvLocal: falhas.length === 0 && !envLocalExiste, falhas };
}

/** Próximos passos que o desenvolvedor roda por conta própria (alguns apagam o banco local). */
export const ORIENTACOES = [
  "Próximos passos (rode você mesmo; este script não executa nada destrutivo):",
  "  1. npx supabase start            sobe o Supabase local (requer Docker), se ainda não estiver rodando",
  "  2. npx supabase db reset         APAGA e recria o banco LOCAL com migrations e seed (usuários fictícios)",
  "  3. Em .env.local, acrescente AUTH_LOCAL_PASSWORD_LOGIN=true para entrar com os usuários de teste do seed",
  "  4. npm run dev                   abre o app em http://localhost:3000",
  "  5. npm run verify                confere tudo (lint, tipos, testes, pgTAP, build, e2e, Lighthouse)",
  "Se o .env.local já existia e precisa ser refeito: npm run setup:local -- --force (sobrescreve).",
];

async function main() {
  console.log("=== 1/3 Pré-requisitos (npm run doctor) ===");
  const itens = await diagnosticar();
  console.log(formatar(itens));
  const plano = planejar({ itens, envLocalExiste: existsSync(".env.local") });

  if (!plano.prosseguir) {
    console.error(`\nPendências antes de continuar: ${plano.falhas.join(", ")}. Veja o README (solução de problemas).`);
    console.log(`\n${ORIENTACOES.join("\n")}`);
    process.exit(1);
  }

  console.log("\n=== 2/3 Variáveis locais (npm run setup:local) ===");
  if (plano.gerarEnvLocal) {
    const r = spawnSync(process.execPath, ["scripts/setup-local.mjs"], { stdio: "inherit" });
    if (r.status !== 0) {
      console.log(`\n${ORIENTACOES.join("\n")}`);
      process.exit(r.status ?? 1);
    }
  } else {
    console.log(".env.local já existe; mantido sem alteração.");
  }

  console.log("\n=== 3/3 Orientações ===");
  console.log(ORIENTACOES.join("\n"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  });
}
