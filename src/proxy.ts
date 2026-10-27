// Proxy do Next.js 16: renova a sessão do Supabase e redireciona conforme sessão e perfil.
// Nega por padrão (src/lib/auth/routes.ts). Não é a única barreira: páginas, Server Actions e
// Route Handlers revalidam no servidor (src/lib/auth/server.ts).
import { NextResponse, type NextRequest } from "next/server";
import { decidirRota, dispensaConsultaDeSessao } from "@/lib/auth/routes";
import { CABECALHOS_SEM_CACHE } from "@/lib/data/cookie-options";
import { atualizarSessaoNoProxy } from "@/lib/data/proxy-session";

function semCache(r: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CABECALHOS_SEM_CACHE)) r.headers.set(k, v);
  return r;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  // Página inicial pública e callback do login: nada a consultar (mantém a página inicial leve).
  if (dispensaConsultaDeSessao(pathname)) return NextResponse.next();

  const { estado, response } = await atualizarSessaoNoProxy(request);
  const decisao = decidirRota(pathname, search, estado);

  if (decisao.tipo === "redirecionar") {
    const redirecionamento = NextResponse.redirect(new URL(decisao.destino, request.url));
    // Leva junto os cookies renovados ou apagados pelo Supabase.
    for (const c of response.cookies.getAll()) redirecionamento.cookies.set(c);
    return semCache(redirecionamento);
  }
  return semCache(response);
}

// Tudo passa pelo proxy, exceto arquivos estáticos do build, otimização de imagem e ícones/imagens/fontes.
// Um caminho que termine numa dessas extensões pula o proxy, por isso cada página protegida
// também chama exigirPerfilNaPagina (tests/security/rotas-protegidas.test.ts confere).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
