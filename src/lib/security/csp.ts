// Content-Security-Policy por requisição (tarefa 017), no padrão do Next.js 16: o proxy gera um nonce,
// coloca a política no cabeçalho da REQUISIÇÃO (o Next lê o nonce dali e o aplica aos próprios scripts)
// e repete a política na RESPOSTA (o navegador aplica). Funções puras: testadas em tests/unit/csp.test.ts.
// Como evoluir (novo domínio, Storage, Serwist): docs/seguranca/base.md.

export const CABECALHO_CSP = "Content-Security-Policy";
export const CABECALHO_NONCE = "x-nonce";

/** Nonce imprevisível de 128 bits, em base64, novo a cada requisição. */
export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Origens que o navegador pode chamar além do próprio site: a URL do Supabase (REST, Auth, Storage)
 * e a mesma origem em ws/wss (Realtime). URL ausente ou inválida: nenhuma origem extra.
 */
export function origensDoSupabase(url: string | undefined): string[] {
  if (!url) return [];
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [];
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return [];
  const ws = u.protocol === "https:" ? "wss:" : "ws:";
  return [u.origin, `${ws}//${u.host}`];
}

export type OpcoesDaCsp = {
  nonce: string;
  /** NEXT_PUBLIC_SUPABASE_URL. */
  supabaseUrl?: string;
  /** next dev: React usa eval para depuração e o HMR injeta estilos inline. Nunca em produção. */
  desenvolvimento: boolean;
  /** Site servido por HTTPS: liga upgrade-insecure-requests (em http://localhost quebraria o próprio site). */
  https: boolean;
};

export function montarCsp({ nonce, supabaseUrl, desenvolvimento, https }: OpcoesDaCsp): string {
  const supabase = origensDoSupabase(supabaseUrl);
  const diretivas: [string, ...string[]][] = [
    ["default-src", "'self'"],
    // 'strict-dynamic': scripts carregados pelos scripts com nonce também valem; 'self' fica só
    // como reserva para navegadores sem CSP 3.
    ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(desenvolvimento ? ["'unsafe-eval'"] : [])],
    ["style-src", "'self'", ...(desenvolvimento ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    ["img-src", "'self'", "blob:", "data:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...supabase],
    ["worker-src", "'self'"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    // Login Microsoft: a Server Action redireciona ao Supabase Auth (só a origem http(s), sem ws).
    ["form-action", "'self'", ...supabase.slice(0, 1)],
    ["frame-ancestors", "'none'"],
  ];
  const texto = diretivas.map((d) => d.join(" "));
  if (https) texto.push("upgrade-insecure-requests");
  return texto.join("; ");
}

/** Extrai o nonce de uma política (usado nos testes e na verificação do e2e). */
export function nonceDaCsp(csp: string): string | null {
  return /'nonce-([^']+)'/.exec(csp)?.[1] ?? null;
}
