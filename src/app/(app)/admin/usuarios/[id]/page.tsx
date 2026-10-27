import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MENSAGEM_PROPRIO_PERFIL } from "@/lib/auth/regras-de-perfil";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { isDataError } from "@/lib/data/errors";
import { getProfile, listRoleHistory } from "@/lib/data/profiles";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { nomeDaPessoa } from "@/lib/format";
import { SeloDePerfil, TabelaDeHistorico, Trilha } from "../../componentes";
import { FormularioDePerfil } from "../../formularios";

export const metadata: Metadata = { title: "Perfil da pessoa | Administração | Plataforma de Ensaios" };

type Parametros = Promise<{ id: string }>;

// Só coordination.
async function Conteudo({ params }: { params: Parametros }) {
  const { userId } = await exigirPerfilNaPagina(["coordination"]);
  const { id } = await params;
  const db = await createServerSupabase();
  const pessoa = await getProfile(db, id).catch((e: unknown) => {
    if (isDataError(e) && e.code === "invalid") return null; // id malformado: não encontrado
    throw e;
  });
  if (!pessoa) notFound();
  const historico = await listRoleHistory(db, { userId: pessoa.id, limite: 50 });
  const nome = nomeDaPessoa(pessoa);
  const ehVoce = pessoa.id === userId;

  return (
    <>
      <Trilha
        itens={[
          { href: "/admin", rotulo: "Administração" },
          { href: "/admin/usuarios", rotulo: "Pessoas e perfis" },
          { rotulo: nome },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">{nome}</h1>
      <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium">E-mail</dt>
        <dd className="break-all">{pessoa.email}</dd>
        <dt className="font-medium">Perfil atual</dt>
        <dd>
          <SeloDePerfil papel={pessoa.role} />
        </dd>
      </dl>

      <section aria-labelledby="alterar-perfil" className="flex flex-col gap-3">
        <h2 id="alterar-perfil" className="text-xl font-semibold">
          {pessoa.role ? "Alterar perfil" : "Liberar acesso"}
        </h2>
        {ehVoce ? (
          <p className="text-zinc-700 dark:text-zinc-300">{MENSAGEM_PROPRIO_PERFIL}</p>
        ) : (
          <FormularioDePerfil userId={pessoa.id} papelAtual={pessoa.role} />
        )}
      </section>

      <TabelaDeHistorico
        itens={historico}
        tipo="perfil"
        titulo="Histórico de perfil desta pessoa"
        vazio="Nenhuma mudança de perfil registrada para esta pessoa."
      />
    </>
  );
}

export default function PerfilDaPessoaPage({ params }: { params: Parametros }) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}
