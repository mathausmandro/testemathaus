// Validação de ambiente chamada por src/instrumentation.ts (register) na inicialização do servidor.
// - Em qualquer runtime: variáveis públicas (getPublicEnv).
// - No runtime nodejs: também as do servidor (getServerEnv, módulo protegido por "server-only").
// Falha: imprime a mensagem do EnvError (só nomes de variáveis, nunca valores) e encerra o processo
// no nodejs; no edge, relança o erro (lá não há process.exit).
import { EnvError, getPublicEnv } from "./env";

export type DependenciasDaInicializacao = {
  validarPublico?: () => unknown;
  validarServidor?: () => Promise<unknown> | unknown;
  registrar?: (mensagem: string) => void;
  encerrar?: (codigo: number) => void;
};

async function validarServidorPadrao(): Promise<unknown> {
  const { getServerEnv } = await import("./env.server");
  return getServerEnv();
}

export const PREFIXO_DA_FALHA = "Falha na inicialização do servidor:";

export async function validarAmbienteNaInicializacao(
  runtime: string | undefined,
  {
    validarPublico = getPublicEnv,
    validarServidor = validarServidorPadrao,
    registrar = (m) => console.error(m),
    encerrar = (c) => process.exit(c),
  }: DependenciasDaInicializacao = {},
): Promise<void> {
  try {
    validarPublico();
    if (runtime === "nodejs") await validarServidor();
  } catch (e) {
    if (!(e instanceof EnvError)) throw e;
    registrar(`${PREFIXO_DA_FALHA} ${e.message}`);
    if (runtime === "nodejs") encerrar(1);
    throw e;
  }
}
