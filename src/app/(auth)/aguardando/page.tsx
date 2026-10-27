import type { Metadata } from "next";
import { Suspense } from "react";
import { BotaoSair } from "@/components/botao-sair";
import { exigirSessaoSemPerfilNaPagina } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Aguardando liberação | Plataforma de Ensaios" };

// Exige sessão, mas não perfil; quem já tem perfil vai para o início. Não mostra nenhum dado do sistema.
async function Conteudo() {
  const sessao = await exigirSessaoSemPerfilNaPagina();
  return (
    <>
      <p className="max-w-md text-lg text-zinc-700 dark:text-zinc-300">
        Sua conta{sessao.email ? ` (${sessao.email})` : ""} foi reconhecida, mas ainda não tem um perfil de acesso.
      </p>
      <p className="max-w-md text-zinc-700 dark:text-zinc-300">
        A coordenação dos ensaios precisa liberar o seu acesso. Procure a coordenação e, depois da liberação, entre novamente.
      </p>
      <BotaoSair />
    </>
  );
}

export default function AguardandoPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Aguardando liberação de acesso</h1>
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
