import { sairDaConta } from "@/app/(auth)/actions";

/** Botão de sair (Server Action em formulário; funciona sem JavaScript). */
export function BotaoSair() {
  return (
    <form action={sairDaConta}>
      <button
        type="submit"
        className="rounded-md border border-zinc-500 px-3 py-2 text-sm font-medium hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:hover:bg-zinc-800"
      >
        Sair
      </button>
    </form>
  );
}
