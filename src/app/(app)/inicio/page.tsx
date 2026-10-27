import type { Metadata } from "next";
import { Suspense } from "react";
import { NOMES_DOS_PERFIS } from "@/lib/auth/guard";
import { exigirPerfilNaPagina } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Início | Plataforma de Ensaios" };

// Qualquer perfil. As telas de negócio chegam na tarefa 016.
async function Conteudo() {
  const { perfil } = await exigirPerfilNaPagina();
  return (
    <p className="text-zinc-700 dark:text-zinc-300">
      Olá, {perfil.full_name ?? perfil.email}. Seu perfil: {NOMES_DOS_PERFIS[perfil.role]}.
    </p>
  );
}

export default function InicioPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
