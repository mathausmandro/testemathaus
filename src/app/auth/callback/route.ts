// Retorno do login Microsoft (PKCE): troca o código por sessão e grava os cookies.
// O destino final vem de ?next= e passa por caminhoDeRetornoSeguro: nunca sai do próprio site.
import { NextResponse, type NextRequest } from "next/server";
import { getConfigDeLogin, origemDoSite } from "@/lib/auth/config";
import { caminhoDeRetornoSeguro } from "@/lib/auth/redirect";
import { trocarCodigoPorSessao } from "@/lib/data/auth";
import { CABECALHOS_SEM_CACHE } from "@/lib/data/cookie-options";
import { createServerSupabase } from "@/lib/data/server/server-client";

function redirecionar(origem: string, caminho: string): NextResponse {
  const r = NextResponse.redirect(new URL(caminho, origem), 303);
  for (const [k, v] of Object.entries(CABECALHOS_SEM_CACHE)) r.headers.set(k, v);
  return r;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const origem = origemDoSite(getConfigDeLogin(), request.nextUrl.origin);
  const next = caminhoDeRetornoSeguro(params.get("next"));

  // Erro devolvido pelo provedor ou pelo hook de domínio: mensagem fixa, nada da URL é refletido.
  if (params.get("error") || params.get("error_code")) return redirecionar(origem, "/login?erro=provedor");

  const codigo = params.get("code");
  if (!codigo || codigo.length > 1024) return redirecionar(origem, "/login?erro=callback");

  try {
    await trocarCodigoPorSessao(await createServerSupabase(), codigo);
  } catch {
    return redirecionar(origem, "/login?erro=callback");
  }
  return redirecionar(origem, next);
}
