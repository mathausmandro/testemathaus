"use client";
// Formulários da administração. Funcionam sem JavaScript (Server Action no action do form);
// com JavaScript, mostram o resultado sem recarregar e levam o foco à mensagem.
// Nenhuma regra de segurança mora aqui: o servidor e o banco revalidam tudo.
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { AppRole } from "@/lib/data/types";
import { atribuirAoEnsaio, definirPerfil, removerDoEnsaio } from "./actions";
import { ESTADO_INICIAL, type EstadoDaAcao } from "./estado";

const CAMPO =
  "rounded-md border border-zinc-500 bg-white px-3 py-2 text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 aria-[invalid=true]:border-red-700 dark:bg-zinc-900 dark:text-zinc-100";
const BOTAO =
  "rounded-md bg-blue-800 px-4 py-2 font-medium text-white hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-60";
const BOTAO_PERIGO =
  "rounded-md bg-red-800 px-4 py-2 font-medium text-white hover:bg-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-60";

function Mensagem({ estado }: { estado: EstadoDaAcao }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (estado.status !== "ocioso") ref.current?.focus();
  }, [estado]);
  if (estado.status === "ocioso") return null;
  const ok = estado.status === "ok";
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role={ok ? "status" : "alert"}
      className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
        ok
          ? "border-green-800 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
          : "border-red-800 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
      }`}
    >
      {estado.mensagem}
    </p>
  );
}

function ErroDoCampo({ id, erro }: { id: string; erro?: string }) {
  if (!erro) return null;
  return (
    <p id={id} className="text-sm text-red-800 dark:text-red-300">
      {erro}
    </p>
  );
}

const OPCOES_DE_PERFIL: { valor: AppRole | "sem_perfil"; rotulo: string }[] = [
  { valor: "coordination", rotulo: "Coordenação" },
  { valor: "field", rotulo: "Campo" },
  { valor: "home_office", rotulo: "Home office" },
  { valor: "sem_perfil", rotulo: "Sem perfil (revogar acesso)" },
];

export function FormularioDePerfil({ userId, papelAtual }: { userId: string; papelAtual: AppRole | null }) {
  const [estado, acao, enviando] = useActionState(definirPerfil, ESTADO_INICIAL);
  const [perfil, setPerfil] = useState<string>(papelAtual ?? "field");
  const id = useId();
  const erros = estado.campos ?? {};
  const revogando = perfil === "sem_perfil";

  return (
    <form action={acao} className="flex max-w-xl flex-col gap-4" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <Mensagem estado={estado} />

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-perfil`} className="font-medium">
          Perfil de acesso
        </label>
        <select
          id={`${id}-perfil`}
          name="perfil"
          value={perfil}
          onChange={(e) => setPerfil(e.target.value)}
          aria-invalid={!!erros.perfil}
          aria-describedby={erros.perfil ? `${id}-perfil-erro` : undefined}
          className={CAMPO}
        >
          {OPCOES_DE_PERFIL.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <ErroDoCampo id={`${id}-perfil-erro`} erro={erros.perfil} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-motivo`} className="font-medium">
          Motivo (obrigatório)
        </label>
        <textarea
          id={`${id}-motivo`}
          name="motivo"
          required
          minLength={3}
          maxLength={500}
          rows={3}
          aria-invalid={!!erros.motivo}
          aria-describedby={`${id}-motivo-ajuda${erros.motivo ? ` ${id}-motivo-erro` : ""}`}
          className={CAMPO}
        />
        <p id={`${id}-motivo-ajuda`} className="text-sm text-zinc-700 dark:text-zinc-300">
          Fica registrado no histórico, com seu nome e a data.
        </p>
        <ErroDoCampo id={`${id}-motivo-erro`} erro={erros.motivo} />
      </div>

      {revogando && (
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <input
              id={`${id}-confirmar`}
              type="checkbox"
              name="confirmar"
              value="sim"
              aria-invalid={!!erros.confirmar}
              aria-describedby={erros.confirmar ? `${id}-confirmar-erro` : undefined}
              className="mt-1 h-4 w-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            />
            <label htmlFor={`${id}-confirmar`}>
              Confirmo a revogação: a pessoa perde o acesso e volta para &quot;Aguardando liberação&quot;.
            </label>
          </div>
          <ErroDoCampo id={`${id}-confirmar-erro`} erro={erros.confirmar} />
        </div>
      )}

      <div>
        <button type="submit" disabled={enviando} className={revogando ? BOTAO_PERIGO : BOTAO}>
          {enviando ? "Salvando…" : revogando ? "Revogar acesso" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}

export function FormularioDeAtribuicao({
  trialId,
  pessoas,
}: {
  trialId: string;
  pessoas: { id: string; rotulo: string }[];
}) {
  const [estado, acao, enviando] = useActionState(atribuirAoEnsaio, ESTADO_INICIAL);
  const id = useId();
  const erros = estado.campos ?? {};

  if (pessoas.length === 0) {
    return <p className="text-zinc-700 dark:text-zinc-300">Todas as pessoas cadastradas já estão neste ensaio.</p>;
  }

  return (
    <form action={acao} className="flex max-w-xl flex-col gap-4" noValidate>
      <input type="hidden" name="trialId" value={trialId} />
      <Mensagem estado={estado} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-pessoa`} className="font-medium">
          Pessoa
        </label>
        <select
          id={`${id}-pessoa`}
          name="userId"
          required
          defaultValue=""
          aria-invalid={!!erros.userId}
          aria-describedby={erros.userId ? `${id}-pessoa-erro` : undefined}
          className={CAMPO}
        >
          <option value="" disabled>
            Escolha a pessoa
          </option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>
        <ErroDoCampo id={`${id}-pessoa-erro`} erro={erros.userId} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-motivo`} className="font-medium">
          Motivo ou contexto (opcional)
        </label>
        <input
          id={`${id}-motivo`}
          name="motivo"
          maxLength={500}
          aria-invalid={!!erros.motivo}
          aria-describedby={`${id}-motivo-ajuda${erros.motivo ? ` ${id}-motivo-erro` : ""}`}
          className={CAMPO}
        />
        <p id={`${id}-motivo-ajuda`} className="text-sm text-zinc-700 dark:text-zinc-300">
          Sem texto, o histórico registra &quot;Atribuição ao ensaio pela coordenação&quot;.
        </p>
        <ErroDoCampo id={`${id}-motivo-erro`} erro={erros.motivo} />
      </div>
      <div>
        <button type="submit" disabled={enviando} className={BOTAO}>
          {enviando ? "Atribuindo…" : "Atribuir ao ensaio"}
        </button>
      </div>
    </form>
  );
}

export function FormularioDeRetirada({ trialId, userId, nome }: { trialId: string; userId: string; nome: string }) {
  const [estado, acao, enviando] = useActionState(removerDoEnsaio, ESTADO_INICIAL);
  const id = useId();
  const erros = estado.campos ?? {};

  return (
    <details className="rounded-md border border-zinc-300 p-3">
      <summary className="cursor-pointer font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
        Retirar {nome} do ensaio
      </summary>
      <form action={acao} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="trialId" value={trialId} />
        <input type="hidden" name="userId" value={userId} />
        <Mensagem estado={estado} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-motivo`} className="font-medium">
            Motivo da retirada (obrigatório)
          </label>
          <input
            id={`${id}-motivo`}
            name="motivo"
            required
            minLength={3}
            maxLength={500}
            aria-invalid={!!erros.motivo}
            aria-describedby={erros.motivo ? `${id}-motivo-erro` : undefined}
            className={CAMPO}
          />
          <ErroDoCampo id={`${id}-motivo-erro`} erro={erros.motivo} />
        </div>
        <div className="flex items-start gap-2">
          <input
            id={`${id}-confirmar`}
            type="checkbox"
            name="confirmar"
            value="sim"
            aria-invalid={!!erros.confirmar}
            aria-describedby={erros.confirmar ? `${id}-confirmar-erro` : undefined}
            className="mt-1 h-4 w-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          />
          <label htmlFor={`${id}-confirmar`}>Confirmo a retirada: o ensaio deixa de aparecer para {nome}.</label>
        </div>
        <ErroDoCampo id={`${id}-confirmar-erro`} erro={erros.confirmar} />
        <div>
          <button type="submit" disabled={enviando} className={BOTAO_PERIGO}>
            {enviando ? "Retirando…" : "Retirar do ensaio"}
          </button>
        </div>
      </form>
    </details>
  );
}
