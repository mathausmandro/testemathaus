// Componentes de servidor das telas de ensaios (sem estado; sem regra de segurança).
export const LINK =
  "text-blue-800 underline underline-offset-4 hover:text-blue-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:text-blue-300";

export const BOTAO_LINK =
  "inline-block rounded-md bg-blue-800 px-4 py-3 font-medium text-white hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2";

/** Marca os ensaios do seed local: dados fictícios, nunca para uso real. */
export function SeloDeTeste() {
  return (
    <span className="inline-block rounded-full border border-amber-800 bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-950">
      Ensaio de teste · dados fictícios
    </span>
  );
}
