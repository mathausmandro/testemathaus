// Opções dos cookies de sessão do Supabase (usadas pelo cliente de servidor e pelo proxy).
// - HttpOnly: o JavaScript da página não lê o token (mitiga roubo por XSS).
// - SameSite=Lax: necessário para o retorno do login (navegação de topo vinda do provedor
//   leva o cookie do PKCE); Strict quebraria o callback.
// - Secure em produção (NODE_ENV=production). Navegadores aceitam cookie Secure em
//   http://localhost, então `next start` local e o e2e continuam funcionando.
// Consequência: o cliente do navegador (client/browser.ts) não enxerga a sessão; todo acesso
// autenticado passa pelo servidor. Realtime e fila offline (fases 3 e 4) precisarão de um
// caminho próprio (registrado na tarefa 012).

export type OpcoesDeCookie = {
  path: string;
  sameSite: "lax";
  httpOnly: true;
  secure: boolean;
};

export function opcoesDoCookieDeSessao(nodeEnv: string | undefined = process.env.NODE_ENV): OpcoesDeCookie {
  return { path: "/", sameSite: "lax", httpOnly: true, secure: nodeEnv === "production" };
}

/** Cabeçalhos que impedem cache compartilhado de respostas com sessão. */
export const CABECALHOS_SEM_CACHE: Record<string, string> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};
