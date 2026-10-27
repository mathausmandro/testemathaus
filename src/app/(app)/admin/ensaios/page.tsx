import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { listTrials } from "@/lib/data/trials";
import { LINK, Trilha } from "../componentes";

export const metadata: Metadata = { title: "Equipes dos ensaios | Administração | Plataforma de Ensaios" };

// Só coordination (vê todos os ensaios pela RLS).
async function Conteudo() {
  await exigirPerfilNaPagina(["coordination"]);
  const db = await createServerSupabase();
  const ensaios = await listTrials(db);
  return (
    <>
      <Trilha itens={[{ href: "/admin", rotulo: "Administração" }, { rotulo: "Equipes dos ensaios" }]} />
      <h1 className="text-2xl font-semibold tracking-tight">Equipes dos ensaios</h1>
      {ensaios.length === 0 ? (
        <p className="text-zinc-700 dark:text-zinc-300">Nenhum ensaio cadastrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ensaios.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/ensaios/${e.id}`} className={LINK}>
                {e.code}
              </Link>
              {(e.crop || e.location) && (
                <span className="text-zinc-700 dark:text-zinc-300"> · {[e.crop, e.location].filter(Boolean).join(" · ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function EnsaiosAdminPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
