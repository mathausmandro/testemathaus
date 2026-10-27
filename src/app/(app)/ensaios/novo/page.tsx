import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { LINK } from "../componentes";
import { FormularioDeEnsaio } from "./formulario";

export const metadata: Metadata = { title: "Novo ensaio | Plataforma de Ensaios" };

// Só coordination (field e home_office recebem "não encontrado"; a Server Action e a RLS negam de novo).
async function Conteudo() {
  await exigirPerfilNaPagina(["coordination"]);
  return <FormularioDeEnsaio />;
}

export default function NovoEnsaioPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ensaios" className={LINK}>
          Ensaios
        </Link>{" "}
        <span aria-hidden="true">/</span> <span aria-current="page">Novo ensaio</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Novo ensaio</h1>
      <Suspense fallback={<p className="text-zinc-800 dark:text-zinc-200">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
