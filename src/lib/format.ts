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

/** Nome para exibir: nome completo ou, na falta, o e-mail. */
export function nomeDaPessoa(p: { full_name: string | null; email: string } | null | undefined): string {
  if (!p) return "Pessoa removida";
  return p.full_name?.trim() || p.email;
}
