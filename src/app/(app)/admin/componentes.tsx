// Componentes de servidor da administração (sem estado; sem regra de segurança).
import Link from "next/link";
import { NOMES_DOS_PERFIS } from "@/lib/auth/guard";
import type { ItemDoHistorico } from "@/lib/data/profiles";
import type { AppRole } from "@/lib/data/types";
import { formatarDataHora, nomeDaPessoa } from "@/lib/format";

export const LINK = "text-blue-800 underline underline-offset-4 hover:text-blue-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:text-blue-300";

export function SeloDePerfil({ papel }: { papel: AppRole | null }) {
  if (!papel) {
    return (
      <span className="inline-block rounded-full border border-amber-800 bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-950">
        Sem perfil · aguardando liberação
      </span>
    );
  }
  return <span className="inline-block rounded-full border border-zinc-500 px-2 py-0.5 text-sm">{NOMES_DOS_PERFIS[papel]}</span>;
}

const nomeDoPapel = (p: AppRole | null) => (p ? NOMES_DOS_PERFIS[p] : "Sem perfil");

function descricao(item: ItemDoHistorico, tipo: "perfil" | "membro"): string {
  if (tipo === "perfil") return `${nomeDoPapel(item.papelAnterior)} → ${nomeDoPapel(item.papelNovo)}`;
  if (item.operation === "INSERT") return "Atribuída ao ensaio";
  if (item.operation === "DELETE") return "Retirada do ensaio";
  return "Atribuição alterada";
}

export function TabelaDeHistorico({
  itens,
  tipo,
  titulo,
  vazio,
}: {
  itens: ItemDoHistorico[];
  tipo: "perfil" | "membro";
  titulo: string;
  vazio: string;
}) {
  return (
    <section aria-labelledby={`historico-${tipo}`} className="flex flex-col gap-2">
      <h2 id={`historico-${tipo}`} className="text-xl font-semibold">
        {titulo}
      </h2>
      {itens.length === 0 ? (
        <p className="text-zinc-700 dark:text-zinc-300">{vazio}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <caption className="sr-only">{titulo} (horário de Brasília)</caption>
            <thead>
              <tr className="border-b border-zinc-400">
                <th scope="col" className="py-2 pr-4">Quando</th>
                <th scope="col" className="py-2 pr-4">Pessoa</th>
                <th scope="col" className="py-2 pr-4">Mudança</th>
                <th scope="col" className="py-2 pr-4">Motivo</th>
                <th scope="col" className="py-2 pr-4">Feita por</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className="border-b border-zinc-200 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{formatarDataHora(i.changedAt)}</td>
                  <td className="py-2 pr-4">{i.pessoa ? nomeDaPessoa(i.pessoa) : "—"}</td>
                  <td className="py-2 pr-4">{descricao(i, tipo)}</td>
                  <td className="py-2 pr-4">{i.reason ?? "—"}</td>
                  <td className="py-2 pr-4">{i.autor ? nomeDaPessoa(i.autor) : "Sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Trilha({ itens }: { itens: { href?: string; rotulo: string }[] }) {
  return (
    <nav aria-label="Trilha" className="text-sm">
      <ol className="flex flex-wrap gap-2">
        {itens.map((i, n) => (
          <li key={i.rotulo} className="flex gap-2">
            {n > 0 && <span aria-hidden="true">/</span>}
            {i.href ? (
              <Link href={i.href} className={LINK}>
                {i.rotulo}
              </Link>
            ) : (
              <span aria-current="page">{i.rotulo}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
