// Retorno do login Microsoft (PKCE): troca o código por sessão e grava os cookies.
// O destino final vem de ?next= e passa por caminhoDeRetornoSeguro: nunca sai do próprio site.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getConfigDeLogin, origemDoSite } from "@/lib/auth/config";
import { campoDeRetornoSchema } from "@/lib/auth/redirect";
import { trocarCodigoPorSessao } from "@/lib/data/auth";
import { CABECALHOS_SEM_CACHE } from "@/lib/data/cookie-options";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { lerParametros, validarEntrada } from "@/lib/validation";

// Entrada da query string validada com zod (src/lib/validation). Código ausente ou fora do formato: erro fixo.
const parametrosSchema = z.object({
  code: z.string().min(1).max(1024).optional().catch(undefined),
  next: campoDeRetornoSchema,
});

function redirecionar(origem: string, caminho: string): NextResponse {
  const r = NextResponse.redirect(new URL(caminho, origem), 303);
  for (const [k, v] of Object.entries(CABECALHOS_SEM_CACHE)) r.headers.set(k, v);
  return r;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const origem = origemDoSite(getConfigDeLogin(), request.nextUrl.origin);
  const { code: codigo, next } = validarEntrada(parametrosSchema, lerParametros(params, ["code", "next"]));

  // Erro devolvido pelo provedor ou pelo hook de domínio: mensagem fixa, nada da URL é refletido.
  if (params.has("error") || params.has("error_code")) return redirecionar(origem, "/login?erro=provedor");

  if (!codigo) return redirecionar(origem, "/login?erro=callback");

  try {
    await trocarCodigoPorSessao(await createServerSupabase(), codigo);
  } catch {
    return redirecionar(origem, "/login?erro=callback");
  }
  return redirecionar(origem, next);
}
