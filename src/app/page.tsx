import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Plataforma de Ensaios</h1>
      <p className="max-w-md text-lg text-zinc-700 dark:text-zinc-300">
        Em construção. Em breve: casualização, croqui, cronograma e coleta de dados de campo.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-blue-800 px-4 py-2 font-medium text-white hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
      >
        Entrar
      </Link>
    </main>
  );
}
