// Cabeçalhos de segurança fixos (tarefa 017), aplicados pelo next.config.ts a todas as respostas.
// A Content-Security-Policy não está aqui: ela tem nonce por requisição e é montada no proxy
// (src/lib/security/csp.ts). Política completa e como ajustar: docs/seguranca/base.md.

export type Cabecalho = { key: string; value: string };

/** HSTS de 2 anos com subdomínios. Navegadores ignoram HSTS recebido por HTTP (ex.: http://localhost). */
export const HSTS = "max-age=63072000; includeSubDomains; preload";

export function cabecalhosDeSeguranca(nodeEnv: string | undefined = process.env.NODE_ENV): Cabecalho[] {
  const lista: Cabecalho[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Câmera (fotos da coleta) e localização (parcela) só no próprio site; microfone e o resto bloqueados.
    { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()" },
    // Reserva para navegadores antigos; a CSP já tem frame-ancestors 'none'.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  // Só no build de produção: em `next dev` um HSTS em https://localhost ficaria preso no navegador.
  if (nodeEnv === "production") lista.push({ key: "Strict-Transport-Security", value: HSTS });
  return lista;
}

/** Nomes que toda página deve devolver (teste de cabeçalhos em tests/security). */
export const CABECALHOS_OBRIGATORIOS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
  "strict-transport-security",
] as const;
