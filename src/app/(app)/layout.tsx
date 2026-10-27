import Link from "next/link";
import { Suspense } from "react";
import { BotaoSair } from "@/components/botao-sair";
import { NOMES_DOS_PERFIS } from "@/lib/auth/guard";
import { exigirPerfilNaPagina } from "@/lib/auth/server";
import { perfisDaArea } from "@/lib/auth/routes";

// Navegação mínima das áreas logadas, conforme o perfil. Esconder link não é segurança:
// cada página chama exigirPerfilNaPagina com os perfis permitidos.
const LINKS = [
  { href: "/inicio", rotulo: "Início" },
  { href: "/admin", rotulo: "Administração" },
] as const;

async function Navegacao() {
  const { perfil } = await exigirPerfilNaPagina();
  const visiveis = LINKS.filter((l) => {
    const perfis = perfisDaArea(l.href);
    return !perfis || perfis.includes(perfil.role);
  });
  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
      <nav aria-label="Principal">
        <ul className="flex gap-4">
          {visiveis.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="underline-offset-4 hover:underline">
                {l.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-3 text-sm">
        <span>
          {perfil.full_name ?? perfil.email} · {NOMES_DOS_PERFIS[perfil.role]}
        </span>
        <BotaoSair />
      </div>
    </div>
  );
}

export default function AreaLogadaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex flex-wrap items-center gap-6 border-b border-zinc-300 px-6 py-3">
        <span className="font-semibold">Plataforma de Ensaios</span>
        <Suspense fallback={null}>
          <Navegacao />
        </Suspense>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
