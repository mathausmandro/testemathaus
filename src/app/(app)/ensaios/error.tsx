"use client";
// Falha inesperada nas telas de ensaios: mensagem genérica em pt-BR (sem detalhes internos) e nova tentativa.

export default function ErroDosEnsaios({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-start gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Não foi possível carregar os ensaios</h1>
      <p role="alert">Ocorreu um erro inesperado. Tente novamente em instantes.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-blue-800 px-4 py-3 font-medium text-white hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
      >
        Tentar novamente
      </button>
    </main>
  );
}
