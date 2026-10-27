import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { listProfiles, listRoleHistory } from "@/lib/data/profiles";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { nomeDaPessoa } from "@/lib/format";
import { LINK, SeloDePerfil, TabelaDeHistorico, Trilha } from "../componentes";

export const metadata: Metadata = { title: "Pessoas e perfis | Administração | Plataforma de Ensaios" };

type Busca = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function urlDaPagina(pagina: number, filtro: string) {
  const p = new URLSearchParams();
  if (filtro !== "todos") p.set("filtro", filtro);
  if (pagina > 1) p.set("pagina", String(pagina));
  const qs = p.toString();
  return qs ? `/admin/usuarios?${qs}` : "/admin/usuarios";
}

// Só coordination. A lista é paginada no banco (25 por página).
async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const { userId } = await exigirPerfilNaPagina(["coordination"]);
  const busca = await searchParams;
  const db = await createServerSupabase();
  const [lista, historico] = await Promise.all([
    listProfiles(db, { pagina: um(busca.pagina), filtro: um(busca.filtro) }),
    listRoleHistory(db, { limite: 20 }),
  ]);
  const paginas = Math.max(1, Math.ceil(lista.total / lista.porPagina));

  return (
    <>
      <Trilha itens={[{ href: "/admin", rotulo: "Administração" }, { rotulo: "Pessoas e perfis" }]} />
      <h1 className="text-2xl font-semibold tracking-tight">Pessoas e perfis</h1>
      <p className="text-zinc-700 dark:text-zinc-300">
        Quem entra pela primeira vez aparece aqui sem perfil e só acessa o sistema depois que a coordenação atribui um perfil.
      </p>

      <nav aria-label="Filtro de pessoas" className="flex gap-4">
        {[
          { valor: "todos", rotulo: "Todas" },
          { valor: "sem_perfil", rotulo: "Sem perfil" },
        ].map((f) => (
          <Link
            key={f.valor}
            href={urlDaPagina(1, f.valor)}
            aria-current={lista.filtro === f.valor ? "page" : undefined}
            className={`${LINK} ${lista.filtro === f.valor ? "font-semibold" : ""}`}
          >
            {f.rotulo}
          </Link>
        ))}
      </nav>

      {lista.itens.length === 0 ? (
        <p className="text-zinc-700 dark:text-zinc-300">
          {lista.filtro === "sem_perfil" ? "Ninguém aguarda liberação." : "Nenhuma pessoa nesta página."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <caption className="sr-only">
              Pessoas cadastradas, página {lista.pagina} de {paginas} ({lista.total} no total)
            </caption>
            <thead>
              <tr className="border-b border-zinc-400">
                <th scope="col" className="py-2 pr-4">
                  Nome
                </th>
                <th scope="col" className="py-2 pr-4">
                  E-mail
                </th>
                <th scope="col" className="py-2 pr-4">
                  Perfil
                </th>
                <th scope="col" className="py-2 pr-4">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((p) => (
                <tr key={p.id} className={`border-b border-zinc-200 ${p.role ? "" : "bg-amber-50 dark:bg-amber-950"}`}>
                  <td className="py-2 pr-4">
                    {nomeDaPessoa(p)}
                    {p.id === userId && <span className="text-sm text-zinc-700 dark:text-zinc-300"> (você)</span>}
                  </td>
                  <td className="py-2 pr-4 break-all">{p.email}</td>
                  <td className="py-2 pr-4">
                    <SeloDePerfil papel={p.role} />
                  </td>
                  <td className="py-2 pr-4">
                    <Link href={`/admin/usuarios/${p.id}`} className={LINK}>
                      {p.role ? "Alterar perfil" : "Liberar acesso"}
                      <span className="sr-only"> de {nomeDaPessoa(p)}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-4">
          {lista.pagina > 1 && (
            <Link href={urlDaPagina(lista.pagina - 1, lista.filtro)} className={LINK}>
              Página anterior
            </Link>
          )}
          <span>
            Página {lista.pagina} de {paginas}
          </span>
          {lista.pagina < paginas && (
            <Link href={urlDaPagina(lista.pagina + 1, lista.filtro)} className={LINK}>
              Próxima página
            </Link>
          )}
        </nav>
      )}

      <TabelaDeHistorico
        itens={historico}
        tipo="perfil"
        titulo="Últimas mudanças de perfil"
        vazio="Nenhuma mudança de perfil registrada ainda."
      />
    </>
  );
}

export default function UsuariosPage({ searchParams }: { searchParams: Busca }) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <Suspense fallback={<p className="text-zinc-700 dark:text-zinc-300">Carregando…</p>}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
