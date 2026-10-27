// Decisões de rota do proxy (funções puras, testadas sem servidor).
// Regra geral: NEGA POR PADRÃO. Só as rotas listadas em ROTAS_PUBLICAS dispensam sessão;
// qualquer rota nova fica protegida automaticamente. O proxy não é a única barreira: cada
// página, Server Action e Route Handler protegido revalida sessão e perfil no servidor.
import type { AppRole } from "../data/types";
import { caminhoDeRetornoSeguro, DESTINO_PADRAO } from "./redirect";

export const ROTA_LOGIN = "/login";
export const ROTA_AGUARDANDO = "/aguardando";
export const ROTA_CALLBACK = "/auth/callback";

/** Rotas que qualquer pessoa acessa, com ou sem sessão (comparação exata). */
export const ROTAS_PUBLICAS: readonly string[] = ["/", ROTA_LOGIN, ROTA_CALLBACK];

/** Áreas restritas a perfis específicos (prefixo → perfis). As demais áreas logadas valem para todos os perfis. */
export const PERFIS_POR_AREA: Readonly<Record<string, readonly AppRole[]>> = {
  "/admin": ["coordination"],
};

export type EstadoDaSessao =
  | { tipo: "anonimo" }
  | { tipo: "sem_perfil" }
  | { tipo: "com_perfil"; perfil: AppRole }
  | { tipo: "erro" };

export type DecisaoDeRota = { tipo: "seguir" } | { tipo: "redirecionar"; destino: string };

/** Remove a barra final (exceto na raiz) para comparar caminhos. */
export function normalizarCaminho(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "") || "/";
  return pathname;
}

export function ehRotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.includes(normalizarCaminho(pathname));
}

/** Rotas públicas que não precisam nem consultar a sessão (o proxy segue direto). */
export function dispensaConsultaDeSessao(pathname: string): boolean {
  const p = normalizarCaminho(pathname);
  return p === "/" || p === ROTA_CALLBACK;
}

export function perfisDaArea(pathname: string): readonly AppRole[] | null {
  const p = normalizarCaminho(pathname);
  for (const [prefixo, perfis] of Object.entries(PERFIS_POR_AREA)) {
    if (p === prefixo || p.startsWith(`${prefixo}/`)) return perfis;
  }
  return null;
}

function paraLogin(pathname: string, search: string, erro?: string): string {
  const params = new URLSearchParams();
  if (erro) params.set("erro", erro);
  const alvo = `${pathname}${search}`;
  // Só leva o "next" se ele for um retorno permitido (o próprio login revalida).
  if (caminhoDeRetornoSeguro(alvo, "") === alvo) params.set("next", alvo);
  const qs = params.toString();
  return qs ? `${ROTA_LOGIN}?${qs}` : ROTA_LOGIN;
}

export function decidirRota(pathname: string, search: string, estado: EstadoDaSessao): DecisaoDeRota {
  const p = normalizarCaminho(pathname);
  const seguir: DecisaoDeRota = { tipo: "seguir" };
  const ir = (destino: string): DecisaoDeRota => ({ tipo: "redirecionar", destino });

  if (dispensaConsultaDeSessao(p)) return seguir;

  if (p === ROTA_LOGIN) {
    if (estado.tipo === "sem_perfil") return ir(ROTA_AGUARDANDO);
    if (estado.tipo === "com_perfil") return ir(DESTINO_PADRAO);
    return seguir; // anônimo ou erro: mostra o login
  }

  if (estado.tipo === "anonimo") return ir(paraLogin(p, search));
  if (estado.tipo === "erro") return ir(`${ROTA_LOGIN}?erro=indisponivel`);

  if (p === ROTA_AGUARDANDO) return estado.tipo === "sem_perfil" ? seguir : ir(DESTINO_PADRAO);
  if (estado.tipo === "sem_perfil") return ir(ROTA_AGUARDANDO);

  const perfis = perfisDaArea(p);
  if (perfis && !perfis.includes(estado.perfil)) return ir(DESTINO_PADRAO);
  return seguir;
}
