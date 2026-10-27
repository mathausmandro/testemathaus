import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NOMES_DOS_PERFIS } from "@/lib/auth/guard";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { isDataError } from "@/lib/data/errors";
import { listPlots, listTreatments } from "@/lib/data/protocol";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { listTrialMembers } from "@/lib/data/trial-members";
import { getTrial } from "@/lib/data/trials";
import { ehEnsaioDeTeste, formatarData, nomeDaPessoa, nomeDoDelineamento, NOMES_DOS_STATUS } from "@/lib/format";
import { LINK, SeloDeTeste } from "../componentes";

export const metadata: Metadata = { title: "Ensaio | Plataforma de Ensaios" };

type Parametros = Promise<{ id: string }>;

const CELULA = "py-2 pr-4";

// Qualquer perfil. Ensaio que a RLS não deixa ver (ou id malformado) responde "não encontrado",
// sem revelar se ele existe.
async function Conteudo({ params }: { params: Parametros }) {
  await exigirPerfilNaPagina();
  const { id } = await params;
  const db = await createServerSupabase();
  const ensaio = await getTrial(db, id).catch((e: unknown) => {
    if (isDataError(e) && e.code === "invalid") return null;
    throw e;
  });
  if (!ensaio) notFound();

  const tratamentos = await listTreatments(db, ensaio.id);
  const [parcelas, membros] = await Promise.all([listPlots(db, ensaio.id, tratamentos), listTrialMembers(db, ensaio.id)]);

  const identificacao: [string, string][] = [
    ["Contratante", ensaio.contractor ?? "—"],
    ["Cultura", ensaio.crop ?? "—"],
    ["Local", ensaio.location ?? "—"],
    ["Delineamento", nomeDoDelineamento(ensaio.design)],
    ["Início previsto", formatarData(ensaio.planned_start_date)],
    ["Fim previsto", formatarData(ensaio.planned_end_date)],
    ["Responsável técnico", ensaio.technical_lead ?? "—"],
    ["Situação", NOMES_DOS_STATUS[ensaio.status] ?? ensaio.status],
  ];

  return (
    <>
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ensaios" className={LINK}>
          Ensaios
        </Link>{" "}
        <span aria-hidden="true">/</span> <span aria-current="page">{ensaio.code}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ensaio {ensaio.code}</h1>
        {ehEnsaioDeTeste(ensaio.code) && <SeloDeTeste />}
      </div>

      <section aria-labelledby="identificacao" className="flex flex-col gap-2">
        <h2 id="identificacao" className="text-xl font-semibold">
          Identificação
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {identificacao.map(([rotulo, valor]) => (
            <div key={rotulo} className="contents">
              <dt className="font-medium">{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="equipe" className="flex flex-col gap-2">
        <h2 id="equipe" className="text-xl font-semibold">
          Equipe atribuída
        </h2>
        {membros.length === 0 ? (
          <p>Ninguém atribuído. A coordenação vê todos os ensaios mesmo sem atribuição.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {membros.map((m) => (
              <li key={m.id}>
                {nomeDaPessoa(m.pessoa)}
                {m.pessoa?.role ? ` · ${NOMES_DOS_PERFIS[m.pessoa.role]}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tratamentos" className="flex flex-col gap-2">
        <h2 id="tratamentos" className="text-xl font-semibold">
          Tratamentos
        </h2>
        {tratamentos.length === 0 ? (
          <p>Nenhum tratamento cadastrado. O protocolo é cadastrado na Fase 2.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">Tratamentos do ensaio {ensaio.code}</caption>
              <thead>
                <tr className="border-b border-zinc-400">
                  <th scope="col" className={CELULA}>Nº</th>
                  <th scope="col" className={CELULA}>Tratamento</th>
                  <th scope="col" className={CELULA}>Produto</th>
                  <th scope="col" className={CELULA}>Dose</th>
                  <th scope="col" className={CELULA}>Aplicação</th>
                </tr>
              </thead>
              <tbody>
                {tratamentos.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-200">
                    <td className={CELULA}>{t.number}</td>
                    <th scope="row" className={`${CELULA} font-medium`}>{t.name}</th>
                    <td className={CELULA}>{t.product ?? "—"}</td>
                    <td className={CELULA}>{t.dose === null ? "—" : `${t.dose.toLocaleString("pt-BR")} ${t.dose_unit ?? ""}`.trim()}</td>
                    <td className={CELULA}>{t.timing ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="parcelas" className="flex flex-col gap-2">
        <h2 id="parcelas" className="text-xl font-semibold">
          Parcelas
        </h2>
        {parcelas.length === 0 ? (
          <p>Nenhuma parcela cadastrada. A casualização e o croqui chegam na Fase 2.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">Parcelas do ensaio {ensaio.code}</caption>
              <thead>
                <tr className="border-b border-zinc-400">
                  <th scope="col" className={CELULA}>Parcela</th>
                  <th scope="col" className={CELULA}>Bloco</th>
                  <th scope="col" className={CELULA}>Tratamento</th>
                  <th scope="col" className={CELULA}>Linha</th>
                  <th scope="col" className={CELULA}>Coluna</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-200">
                    <th scope="row" className={`${CELULA} font-medium`}>{p.number}</th>
                    <td className={CELULA}>{p.block ?? "—"}</td>
                    <td className={CELULA}>{p.treatment ? `${p.treatment.number} · ${p.treatment.name}` : "—"}</td>
                    <td className={CELULA}>{p.grid_row ?? "—"}</td>
                    <td className={CELULA}>{p.grid_column ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          A distribuição dos tratamentos nas parcelas é a do cadastro; a casualização reproduzível (com semente) vem na Fase 2.
        </p>
      </section>
    </>
  );
}

export default function EnsaioPage({ params }: { params: Parametros }) {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <Suspense fallback={<p className="text-zinc-800 dark:text-zinc-200">Carregando ensaio…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}
