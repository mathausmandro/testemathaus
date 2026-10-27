"use client";
// Formulário de novo ensaio. Funciona sem JavaScript (Server Action no action do form); com JavaScript,
// mostra os erros por campo sem recarregar e leva o foco à mensagem. Nenhuma regra de segurança mora aqui.
import { useActionState, useEffect, useId, useRef } from "react";
import { ESTADO_INICIAL } from "../../admin/estado";
import { criarEnsaio } from "../actions";

const CAMPO =
  "rounded-md border border-zinc-500 bg-white px-3 py-2 text-base text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 aria-[invalid=true]:border-red-700 dark:bg-zinc-900 dark:text-zinc-100";
const BOTAO =
  "rounded-md bg-blue-800 px-4 py-3 font-medium text-white hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-60";

// Delineamentos do banco (enum trial_design). Opções adicionais dependem do Mathaus.
const DELINEAMENTOS = [
  { valor: "dbc", rotulo: "Blocos casualizados (DBC)" },
  { valor: "dic", rotulo: "Inteiramente casualizado (DIC)" },
  { valor: "factorial", rotulo: "Fatorial" },
  { valor: "split_plot", rotulo: "Parcelas subdivididas" },
];

export function FormularioDeEnsaio() {
  const [estado, acao, enviando] = useActionState(criarEnsaio, ESTADO_INICIAL);
  const id = useId();
  const aviso = useRef<HTMLParagraphElement>(null);
  const erros = estado.campos ?? {};

  useEffect(() => {
    if (estado.status === "erro") aviso.current?.focus();
  }, [estado]);

  const campo = (nome: string, rotulo: string, opcoes: { obrigatorio?: boolean; tipo?: string; ajuda?: string } = {}) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${nome}`} className="font-medium">
        {rotulo}
        {opcoes.obrigatorio ? " (obrigatório)" : ""}
      </label>
      <input
        id={`${id}-${nome}`}
        name={nome}
        type={opcoes.tipo ?? "text"}
        required={opcoes.obrigatorio}
        maxLength={opcoes.tipo === "date" ? undefined : nome === "code" ? 50 : 200}
        aria-invalid={!!erros[nome]}
        aria-describedby={erros[nome] ? `${id}-${nome}-erro` : opcoes.ajuda ? `${id}-${nome}-ajuda` : undefined}
        className={CAMPO}
      />
      {opcoes.ajuda && !erros[nome] && (
        <p id={`${id}-${nome}-ajuda`} className="text-sm text-zinc-700 dark:text-zinc-300">
          {opcoes.ajuda}
        </p>
      )}
      {erros[nome] && (
        <p id={`${id}-${nome}-erro`} className="text-sm text-red-800 dark:text-red-300">
          {erros[nome]}
        </p>
      )}
    </div>
  );

  return (
    <form action={acao} className="flex max-w-xl flex-col gap-4" noValidate>
      {estado.status === "erro" && (
        <p
          ref={aviso}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-red-800 bg-red-50 px-3 py-2 text-sm text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:bg-red-950 dark:text-red-100"
        >
          {estado.mensagem}
        </p>
      )}
      {campo("code", "Código do ensaio", { obrigatorio: true, ajuda: "Identificação única do ensaio." })}
      {campo("contractor", "Contratante")}
      {campo("crop", "Cultura")}
      {campo("location", "Local")}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-design`} className="font-medium">
          Delineamento
        </label>
        <select
          id={`${id}-design`}
          name="design"
          defaultValue=""
          aria-invalid={!!erros.design}
          aria-describedby={erros.design ? `${id}-design-erro` : undefined}
          className={CAMPO}
        >
          <option value="">Não definido</option>
          {DELINEAMENTOS.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.rotulo}
            </option>
          ))}
        </select>
        {erros.design && (
          <p id={`${id}-design-erro`} className="text-sm text-red-800 dark:text-red-300">
            {erros.design}
          </p>
        )}
      </div>
      {campo("planned_start_date", "Início previsto", { tipo: "date" })}
      {campo("planned_end_date", "Fim previsto", { tipo: "date" })}
      {campo("technical_lead", "Responsável técnico")}
      <div>
        <button type="submit" disabled={enviando} className={BOTAO}>
          {enviando ? "Salvando…" : "Criar ensaio"}
        </button>
      </div>
    </form>
  );
}
