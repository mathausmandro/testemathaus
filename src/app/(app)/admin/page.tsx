import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { listProfiles } from "@/lib/data/profiles";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { LINK } from "./componentes";

export const metadata: Metadata = { title: "Administração | Plataforma de Ensaios" };

// Só coordination (negado no servidor: field e home_office recebem 404; o proxy já os desvia).
// Nada é exibido antes da checagem.
async function Conteudo() {
  await exigirPerfilNaPagina(["coordination"]);
  const db = await createServerSupabase();
  const aguardando = await listProfiles(db, { filtro: "sem_perfil", porPagina: 1 });
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
      {aguardando.total > 0 && (
        <p role="status" className="rounded-md border border-amber-800 bg-amber-50 px-3 py-2 text-amber-950">
          {aguardando.total === 1 ? "1 pessoa aguarda" : `${aguardando.total} pessoas aguardam`} liberação de acesso.{" "}
          <Link href="/admin/usuarios?filtro=sem_perfil" className={LINK}>
            Ver quem aguarda
          </Link>
        </p>
      )}
      <ul className="flex flex-col gap-3">
        <li>
          <Link href="/admin/usuarios" className={`${LINK} text-lg`}>
            Pessoas e perfis
          </Link>
          <p className="text-zinc-700 dark:text-zinc-300">Liberar acesso, alterar ou revogar o perfil de cada pessoa.</p>
        </li>
        <li>
          <Link href="/admin/ensaios" className={`${LINK} text-lg`}>
            Equipes dos ensaios
          </Link>
          <p className="text-zinc-700 dark:text-zinc-300">Atribuir pessoas a cada ensaio ou retirá-las.</p>
        </li>
      </ul>
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
