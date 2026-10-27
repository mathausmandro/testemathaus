import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NOMES_DOS_PERFIS } from "@/lib/auth/guard";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { isDataError } from "@/lib/data/errors";
import { listProfileOptions } from "@/lib/data/profiles";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { listTrialMemberHistory, listTrialMembers } from "@/lib/data/trial-members";
import { getTrial } from "@/lib/data/trials";
import { nomeDaPessoa } from "@/lib/format";
import { SeloDePerfil, TabelaDeHistorico, Trilha } from "../../componentes";
import { FormularioDeAtribuicao, FormularioDeRetirada } from "../../formularios";

export const metadata: Metadata = { title: "Equipe do ensaio | Administração | Plataforma de Ensaios" };

type Parametros = Promise<{ id: string }>;

// Só coordination.
async function Conteudo({ params }: { params: Parametros }) {
  await exigirPerfilNaPagina(["coordination"]);
  const { id } = await params;
  const db = await createServerSupabase();
  const ensaio = await getTrial(db, id).catch((e: unknown) => {
    if (isDataError(e) && e.code === "invalid") return null; // id malformado: não encontrado
    throw e;
  });
  if (!ensaio) notFound();
  const [membros, pessoas, historico] = await Promise.all([
    listTrialMembers(db, ensaio.id),
    listProfileOptions(db),
    listTrialMemberHistory(db, ensaio.id, 50),
  ]);
  const naEquipe = new Set(membros.map((m) => m.userId));
  // coordination já vê todos os ensaios; não precisa de atribuição.
  const disponiveis = pessoas
    .filter((p) => !naEquipe.has(p.id) && p.role !== "coordination")
    .map((p) => ({ id: p.id, rotulo: `${nomeDaPessoa(p)} (${p.role ? NOMES_DOS_PERFIS[p.role] : "sem perfil"})` }));

  return (
    <>
      <Trilha
        itens={[
          { href: "/admin", rotulo: "Administração" },
          { href: "/admin/ensaios", rotulo: "Equipes dos ensaios" },
          { rotulo: ensaio.code },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Equipe do ensaio {ensaio.code}</h1>

      <section aria-labelledby="membros" className="flex flex-col gap-3">
        <h2 id="membros" className="text-xl font-semibold">
          Pessoas atribuídas
        </h2>
        {membros.length === 0 ? (
          <p className="text-zinc-700 dark:text-zinc-300">Ninguém atribuído. A coordenação vê todos os ensaios mesmo sem atribuição.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {membros.map((m) => {
              const nome = nomeDaPessoa(m.pessoa);
              return (
                <li key={m.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{nome}</span>
                    <SeloDePerfil papel={m.pessoa?.role ?? null} />
                  </div>
                  <FormularioDeRetirada trialId={ensaio.id} userId={m.userId} nome={nome} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="atribuir" className="flex flex-col gap-3">
        <h2 id="atribuir" className="text-xl font-semibold">
          Atribuir pessoa
        </h2>
        <FormularioDeAtribuicao trialId={ensaio.id} pessoas={disponiveis} />
      </section>

      <TabelaDeHistorico
        itens={historico}
        tipo="membro"
        titulo="Histórico da equipe"
        vazio="Nenhuma atribuição registrada para este ensaio."
      />
    </>
  );
}

export default function EquipeDoEnsaioPage({ params }: { params: Parametros }) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}
