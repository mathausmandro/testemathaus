// Ponto de entrada seguro para cliente e servidor (repositórios, tipos e erros).
// Os clientes ficam em ./client/browser e ./server/server-client (import explícito).
export * from "./errors";
export * from "./types";
export {
  getOwnProfile,
  listProfiles,
  listProfileOptions,
  getProfile,
  countCoordination,
  setUserRole,
  listRoleHistory,
  definirPerfilSchema,
  PERFIS,
  type PessoaResumo,
  type ItemDoHistorico,
  type ListaDePessoas,
} from "./profiles";
export { listTrials, getTrial, createTrial, createTrialSchema, type CreateTrialInput } from "./trials";
export {
  listTrialMembers,
  addTrialMember,
  removeTrialMember,
  listTrialMemberHistory,
  atribuirMembroSchema,
  retirarMembroSchema,
  CONTEXTO_PADRAO_DA_ATRIBUICAO,
  type MembroDoEnsaio,
} from "./trial-members";
