// Formatação para a interface (pt-BR, horário de Brasília; regra 11 do CLAUDE.md).

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

/** Data e hora de um timestamptz em America/Sao_Paulo. Valor inválido vira "—". */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATA_HORA.format(d);
}

/** Data sem hora (AAAA-MM-DD, coluna date) como DD/MM/AAAA, sem conversão de fuso. Inválida vira "—". */
export function formatarData(data: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

export const NOMES_DOS_DELINEAMENTOS = {
  dbc: "Blocos casualizados (DBC)",
  dic: "Inteiramente casualizado (DIC)",
  factorial: "Fatorial",
  split_plot: "Parcelas subdivididas",
} as const;

export function nomeDoDelineamento(d: string | null | undefined): string {
  return d && d in NOMES_DOS_DELINEAMENTOS ? NOMES_DOS_DELINEAMENTOS[d as keyof typeof NOMES_DOS_DELINEAMENTOS] : "—";
}

export const NOMES_DOS_STATUS: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

/** Ensaios do seed local têm código ENS-TESTE-nn e dados fictícios; a tela os marca como tal. */
export function ehEnsaioDeTeste(codigo: string): boolean {
  return /^ENS-TESTE-/i.test(codigo);
}

/** Nome para exibir: nome completo ou, na falta, o e-mail. */
export function nomeDaPessoa(p: { full_name: string | null; email: string } | null | undefined): string {
  if (!p) return "Pessoa removida";
  return p.full_name?.trim() || p.email;
}
