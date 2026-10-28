// Proxy do Next.js 16: aplica a CSP com nonce por requisição, renova a sessão do Supabase e
// redireciona conforme sessão e perfil.
// Nega por padrão (src/lib/auth/routes.ts). Não é a única barreira: páginas, Server Actions e
// Route Handlers revalidam no servidor (src/lib/auth/server.ts).
import { NextResponse, type NextRequest } from "next/server";
import { decidirRota, dispensaConsultaDeSessao } from "@/lib/auth/routes";
import { CABECALHOS_SEM_CACHE } from "@/lib/data/cookie-options";
import { atualizarSessaoNoProxy } from "@/lib/data/proxy-session";
import { CABECALHO_CSP, CABECALHO_NONCE, gerarNonce, montarCsp } from "@/lib/security/csp";

function semCache(r: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CABECALHOS_SEM_CACHE)) r.headers.set(k, v);
  return r;
}

/** Site atrás de HTTPS (direto ou via proxy reverso da Vercel/Docker). */
function servidoPorHttps(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

/**
 * Gera o nonce e grava a política no cabeçalho da requisição (o Next aplica o nonce aos scripts que
 * renderiza). Devolve a política para repetir na resposta.
 */
function aplicarCspNaRequisicao(request: NextRequest): string {
  const nonce = gerarNonce();
  const csp = montarCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    desenvolvimento: process.env.NODE_ENV === "development",
    https: servidoPorHttps(request),
  });
  request.headers.set(CABECALHO_NONCE, nonce);
  request.headers.set(CABECALHO_CSP, csp);
  return csp;
}

function comCsp(r: NextResponse, csp: string): NextResponse {
  r.headers.set(CABECALHO_CSP, csp);
  return r;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const csp = aplicarCspNaRequisicao(request);

  // Página inicial pública e callback do login: nada a consultar (mantém a página inicial leve).
  if (dispensaConsultaDeSessao(pathname)) return comCsp(NextResponse.next({ request }), csp);

  const { estado, response } = await atualizarSessaoNoProxy(request);
  const decisao = decidirRota(pathname, search, estado);

  if (decisao.tipo === "redirecionar") {
    const redirecionamento = NextResponse.redirect(new URL(decisao.destino, request.url));
    // Leva junto os cookies renovados ou apagados pelo Supabase.
    for (const c of response.cookies.getAll()) redirecionamento.cookies.set(c);
    return comCsp(semCache(redirecionamento), csp);
  }
  return comCsp(semCache(response), csp);
}

// Tudo passa pelo proxy, exceto arquivos estáticos do build, otimização de imagem e ícones/imagens/fontes.
// Um caminho que termine numa dessas extensões pula o proxy, por isso cada página protegida
// também chama exigirPerfilNaPagina (tests/security/rotas-protegidas.test.ts confere).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
