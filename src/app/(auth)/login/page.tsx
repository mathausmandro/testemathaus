import type { Metadata } from "next";
import { Suspense } from "react";
import { getConfigDeLogin, mensagemDeLogin } from "@/lib/auth/config";
import { caminhoDeRetornoSeguro } from "@/lib/auth/redirect";
import { entrarComMicrosoft, entrarComSenhaLocal } from "./actions";
import { OpcoesDeLogin } from "./opcoes-de-login";

export const metadata: Metadata = { title: "Entrar | Plataforma de Ensaios" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A configuração é lida por requisição (dentro do Suspense), nunca congelada no build.
async function Opcoes({ searchParams }: Props) {
  const sp = await searchParams;
  const next = caminhoDeRetornoSeguro(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  return (
    <OpcoesDeLogin
      config={getConfigDeLogin()}
      erro={mensagemDeLogin(sp.erro)}
      next={next}
      acaoMicrosoft={entrarComMicrosoft}
      acaoSenha={entrarComSenhaLocal}
    />
  );
}

export default function LoginPage({ searchParams }: Props) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">Plataforma de Ensaios</p>
      </div>
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Opcoes searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
