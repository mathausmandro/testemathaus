import type { Metadata } from "next";
import { Suspense } from "react";
import { exigirPerfilNaPagina } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Administração | Plataforma de Ensaios" };

// Só coordination (negado no servidor: field e home_office recebem 404; o proxy já os desvia).
// Nada é exibido antes da checagem. Conteúdo na tarefa 015.
async function Conteudo() {
  await exigirPerfilNaPagina(["coordination"]);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
      <p className="text-zinc-700 dark:text-zinc-300">Administração de perfis e atribuição de ensaios: em construção (tarefa 015).</p>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
