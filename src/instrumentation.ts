// Validação das variáveis de ambiente na INICIALIZAÇÃO do servidor (tarefa 004, correção pós-revisão).
// Sem uma variável obrigatória, o processo encerra com mensagem em português que cita só os NOMES
// das variáveis (nunca os valores). Testes sem Supabase (e2e, Lighthouse, build do verify) recebem
// valores fictícios de scripts/env-ficticia.mjs, nunca de arquivo .env versionado.
import { validarAmbienteNaInicializacao } from "./lib/env-startup";

export async function register(): Promise<void> {
  await validarAmbienteNaInicializacao(process.env.NEXT_RUNTIME);
}
