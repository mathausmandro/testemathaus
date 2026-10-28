import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { EnvError, getPublicEnv } from "./src/lib/env";
import { cabecalhosDeSeguranca } from "./src/lib/security/headers";

export const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  // Cabeçalhos fixos de segurança; a CSP com nonce é aplicada por requisição em src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: cabecalhosDeSeguranca(),
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

/**
 * As NEXT_PUBLIC_* são embutidas no build: sem elas o resultado sairia quebrado. O build falha cedo,
 * com mensagem em português que cita só os nomes (nunca valores). Testes sem Supabase recebem valores
 * fictícios de scripts/env-ficticia.mjs. O servidor revalida tudo, inclusive as variáveis só de
 * servidor, ao iniciar (src/instrumentation.ts).
 */
export function validarAmbienteDoBuild(phase: string, validar: () => unknown = getPublicEnv): void {
  if (phase !== PHASE_PRODUCTION_BUILD) return;
  try {
    validar();
  } catch (e) {
    if (e instanceof EnvError) throw new Error(`Build interrompido. ${e.message}`);
    throw e;
  }
}

export default function configurar(phase: string): NextConfig {
  validarAmbienteDoBuild(phase);
  return nextConfig;
}
