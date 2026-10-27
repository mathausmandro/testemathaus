import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { listTrials } from "@/lib/data/trials";
import { ehEnsaioDeTeste, formatarData, nomeDoDelineamento, NOMES_DOS_STATUS } from "@/lib/format";
import { BOTAO_LINK, LINK, SeloDeTeste } from "./componentes";

export const metadata: Metadata = { title: "Ensaios | Plataforma de Ensaios" };

// Qualquer perfil. A lista vem do banco: a RLS devolve só os ensaios que a pessoa pode ver
// (coordination vê todos; os demais, só os atribuídos).
async function Conteudo() {
  const { perfil } = await exigirPerfilNaPagina();
  const db = await createServerSupabase();
  const ensaios = await listTrials(db);
  const podeCriar = perfil.role === "coordination";

  return (
    <>
      {podeCriar && (
        <div>
          <Link href="/ensaios/novo" className={BOTAO_LINK}>
            Novo ensaio
          </Link>
        </div>
      )}
      {ensaios.length === 0 ? (
        <p className="text-zinc-800 dark:text-zinc-200">
          {podeCriar
            ? "Nenhum ensaio cadastrado ainda. Use “Novo ensaio” para criar o primeiro."
            : "Você ainda não foi atribuído a nenhum ensaio. A coordenação faz a atribuição."}
        </p>
      ) : (
        <ul aria-label="Lista de ensaios" className="flex flex-col gap-3">
          {ensaios.map((e) => (
            <li key={e.id} className="rounded-lg border border-zinc-400 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/ensaios/${e.id}`} className={`${LINK} text-lg font-semibold`}>
                  {e.code}
                </Link>
                {ehEnsaioDeTeste(e.code) && <SeloDeTeste />}
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-medium">Cultura</dt>
                <dd>{e.crop ?? "—"}</dd>
                <dt className="font-medium">Local</dt>
                <dd>{e.location ?? "—"}</dd>
                <dt className="font-medium">Delineamento</dt>
                <dd>{nomeDoDelineamento(e.design)}</dd>
                <dt className="font-medium">Período previsto</dt>
                <dd>
                  {formatarData(e.planned_start_date)} a {formatarData(e.planned_end_date)}
                </dd>
                <dt className="font-medium">Situação</dt>
                <dd>{NOMES_DOS_STATUS[e.status] ?? e.status}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function EnsaiosPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ensaios</h1>
      <Suspense fallback={<p className="text-zinc-800 dark:text-zinc-200">Carregando ensaios…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
