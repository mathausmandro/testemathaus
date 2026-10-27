// Validação do parâmetro de retorno (?next=) contra open redirect.
// Regra: só caminhos relativos do próprio site, começando por um prefixo da lista permitida.
// Qualquer coisa fora disso (URL absoluta, //host, \host, esquema, controle) cai no destino padrão.

/** Destino padrão depois do login. */
export const DESTINO_PADRAO = "/inicio";

/** Áreas logadas para as quais o login pode devolver a pessoa (AGENTS.md: áreas do app). */
export const PREFIXOS_DE_RETORNO = ["/inicio", "/ensaios", "/coleta", "/aplicacoes", "/painel", "/relatorios", "/admin"] as const;

const ORIGEM_FICTICIA = "http://retorno.invalid";

/**
 * Devolve um caminho seguro para redirecionar depois do login.
 * Nunca devolve URL absoluta: o resultado sempre começa com "/" e um prefixo permitido.
 */
export function caminhoDeRetornoSeguro(bruto: string | null | undefined, padrao: string = DESTINO_PADRAO): string {
  if (typeof bruto !== "string") return padrao;
  const v = bruto.trim();
  if (v === "" || v.length > 512) return padrao;
  // Só caminho absoluto do próprio site; recusa //host, /\host, barras invertidas e caracteres de controle.
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return padrao;
  if (/[\u0000-\u001f\u007f]/.test(v)) return padrao;

  let url: URL;
  try {
    url = new URL(v, ORIGEM_FICTICIA);
  } catch {
    return padrao;
  }
  if (url.origin !== ORIGEM_FICTICIA) return padrao;

  // Caminho normalizado (resolve "..", "%2e%2e" etc.) precisa estar na lista permitida.
  const caminho = url.pathname;
  const permitido = PREFIXOS_DE_RETORNO.some((p) => caminho === p || caminho.startsWith(`${p}/`));
  if (!permitido) return padrao;
  return `${caminho}${url.search}${url.hash}`;
}
