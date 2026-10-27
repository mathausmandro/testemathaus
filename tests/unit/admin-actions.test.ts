// @vitest-environment node
// Tarefa 015: Server Actions da administração chamadas direto (sem tela), com cliente Supabase simulado.
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataError } from "@/lib/data/errors";
import { MENSAGEM_PROPRIO_PERFIL, MENSAGEM_ULTIMA_COORDENACAO } from "@/lib/auth/regras-de-perfil";
import { CONTEXTO_PADRAO_DA_ATRIBUICAO } from "@/lib/data/trial-members";

const m = vi.hoisted(() => ({
  exigirPerfil: vi.fn(),
  criarServidor: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ exigirPerfil: m.exigirPerfil }));
vi.mock("@/lib/data/server/server-client", () => ({ createServerSupabase: m.criarServidor }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));

import { atribuirAoEnsaio, definirPerfil, removerDoEnsaio } from "@/app/(app)/admin/actions";
import { ESTADO_INICIAL } from "@/app/(app)/admin/estado";

const COORD = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";
const ENSAIO = "33333333-3333-4333-8333-333333333333";

type Resultado = { data?: unknown; error?: unknown; count?: number | null };

/** Cliente simulado: cada from() consome o próximo resultado da fila; rpc() devolve rpcResultado. */
function fakeDb(fila: Resultado[] = [], rpcResultado: Resultado = { data: null, error: null }) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const from = vi.fn((tabela: string) => {
    chamadas.push({ metodo: "from", args: [tabela] });
    const resultado = { data: null, error: null, count: null, ...(fila.shift() ?? {}) };
    const cadeia: unknown = new Proxy(
      {},
      {
        get(_t, metodo: string) {
          if (metodo === "then") return (res: (v: Resultado) => unknown) => Promise.resolve(resultado).then(res);
          return (...args: unknown[]) => {
            chamadas.push({ metodo, args });
            return cadeia;
          };
        },
      },
    );
    return cadeia;
  });
  const rpc = vi.fn(async () => ({ data: null, error: null, ...rpcResultado }));
  return { db: { from, rpc }, from, rpc, chamadas };
}

const form = (dados: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(dados)) f.set(k, v);
  return f;
};

function comoCoordenacao(db: unknown) {
  m.exigirPerfil.mockResolvedValue({ userId: COORD, email: null, perfil: { id: COORD, role: "coordination" } });
  m.criarServidor.mockResolvedValue(db);
}

const perfil = (id: string, role: string | null) => ({ id, email: "p@exemplo.test", full_name: "Pessoa", role, created_at: "", updated_at: "" });

afterEach(() => {
  vi.clearAllMocks();
});

describe("definirPerfil", () => {
  it.each([
    ["field", new DataError("forbidden"), "Você não tem permissão para esta ação."],
    ["sem sessão", new DataError("unauthenticated"), "Sua sessão expirou. Entre novamente."],
  ])("%s: negado no servidor, sem tocar no banco", async (_nome, erro, mensagem) => {
    m.exigirPerfil.mockRejectedValue(erro);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "coordination", motivo: "Promoção" }));
    expect(r).toEqual({ status: "erro", mensagem, campos: undefined });
    expect(m.criarServidor).not.toHaveBeenCalled();
    expect(m.exigirPerfil).toHaveBeenCalledWith(["coordination"]);
  });

  it("perfil inválido é rejeitado pelo zod", async () => {
    const { db, rpc } = fakeDb();
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "admin", motivo: "Promoção" }));
    expect(r.status).toBe("erro");
    expect(r.campos?.perfil).toBe("Perfil inválido");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("id de pessoa inválido é rejeitado", async () => {
    const { db, rpc } = fakeDb();
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: "1 or 1=1", perfil: "field", motivo: "Promoção" }));
    expect(r.campos?.userId).toBe("Pessoa inválida");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("revogação exige confirmação", async () => {
    const { db, rpc } = fakeDb();
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "sem_perfil", motivo: "Saiu da equipe" }));
    expect(r.campos?.confirmar).toBe("Confirme a revogação do acesso");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("motivo vazio ou curto é rejeitado e volta no campo motivo", async () => {
    const { db, rpc } = fakeDb([{ data: perfil(OUTRA, null) }]);
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "field", motivo: "  a " }));
    expect(r.status).toBe("erro");
    expect(r.campos?.motivo).toMatch(/motivo/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não altera o próprio perfil", async () => {
    const { db, rpc } = fakeDb([{ data: perfil(COORD, "coordination") }, { count: 3 }]);
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: COORD, perfil: "field", motivo: "Quero sair" }));
    expect(r).toMatchObject({ status: "erro", mensagem: MENSAGEM_PROPRIO_PERFIL });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não remove a última coordenação", async () => {
    const { db, rpc, chamadas } = fakeDb([{ data: perfil(OUTRA, "coordination") }, { count: 1 }]);
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "field", motivo: "Troca de função" }));
    expect(r).toMatchObject({ status: "erro", mensagem: MENSAGEM_ULTIMA_COORDENACAO });
    expect(rpc).not.toHaveBeenCalled();
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["role", "coordination"] });
  });

  it("rebaixa uma coordenação quando sobra outra", async () => {
    const { db, rpc } = fakeDb([{ data: perfil(OUTRA, "coordination") }, { count: 2 }]);
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "home_office", motivo: "Troca de função" }));
    expect(r.status).toBe("ok");
    expect(rpc).toHaveBeenCalledWith("admin_set_user_role", { p_user_id: OUTRA, p_role: "home_office", p_reason: "Troca de função" });
  });

  it("libera quem estava sem perfil, com motivo aparado, e revalida a administração", async () => {
    const { db, rpc, chamadas } = fakeDb([{ data: perfil(OUTRA, null) }]);
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "field", motivo: "  Equipe do piloto  " }));
    expect(r).toMatchObject({ status: "ok" });
    expect(rpc).toHaveBeenCalledWith("admin_set_user_role", { p_user_id: OUTRA, p_role: "field", p_reason: "Equipe do piloto" });
    expect(chamadas.filter((c) => c.metodo === "from")).toHaveLength(1); // sem contagem: não era coordination
    expect(m.revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("revoga com confirmação (role nula)", async () => {
    const { db, rpc } = fakeDb([{ data: perfil(OUTRA, "field") }]);
    comoCoordenacao(db);
    const r = await definirPerfil(
      ESTADO_INICIAL,
      form({ userId: OUTRA, perfil: "sem_perfil", motivo: "Saiu da equipe", confirmar: "sim" }),
    );
    expect(r).toEqual({ status: "ok", mensagem: "Acesso revogado." });
    expect(rpc).toHaveBeenCalledWith("admin_set_user_role", { p_user_id: OUTRA, p_role: null, p_reason: "Saiu da equipe" });
  });

  it("mesmo perfil: nada a fazer", async () => {
    const { db, rpc } = fakeDb([{ data: perfil(OUTRA, "field") }]);
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "field", motivo: "Sem mudança" }));
    expect(r.status).toBe("ok");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("pessoa inexistente (ou invisível pela RLS): não encontrada", async () => {
    const { db, rpc } = fakeDb([{ data: null }]);
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "field", motivo: "Liberação" }));
    expect(r).toMatchObject({ status: "erro", mensagem: "Registro não encontrado." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("negação do banco (perfil rebaixado no meio do caminho) vira mensagem genérica", async () => {
    const { db } = fakeDb([{ data: perfil(OUTRA, null) }], {
      error: { code: "42501", message: "Só a coordenação altera perfis de acesso" },
    });
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "field", motivo: "Liberação" }));
    expect(r).toEqual({ status: "erro", mensagem: "Você não tem permissão para esta ação.", campos: undefined });
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("última coordenação barrada pelo banco (corrida) não vaza a mensagem do SQL", async () => {
    const { db } = fakeDb([{ data: perfil(OUTRA, "coordination") }, { count: 2 }], {
      error: { code: "23514", message: "O sistema precisa ter ao menos uma pessoa na coordenação" },
    });
    comoCoordenacao(db);
    const r = await definirPerfil(ESTADO_INICIAL, form({ userId: OUTRA, perfil: "field", motivo: "Troca" }));
    expect(r.status).toBe("erro");
    expect(r.mensagem).toBe("Os dados informados são inválidos.");
  });
});

describe("atribuirAoEnsaio", () => {
  it("home_office: negado sem tocar no banco", async () => {
    m.exigirPerfil.mockRejectedValue(new DataError("forbidden"));
    const r = await atribuirAoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA }));
    expect(r.status).toBe("erro");
    expect(m.criarServidor).not.toHaveBeenCalled();
  });

  it("sem motivo: grava o contexto padrão", async () => {
    const { db, rpc } = fakeDb([], { data: "44444444-4444-4444-8444-444444444444" });
    comoCoordenacao(db);
    const r = await atribuirAoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA, motivo: "" }));
    expect(r).toEqual({ status: "ok", mensagem: "Pessoa atribuída ao ensaio." });
    expect(rpc).toHaveBeenCalledWith("admin_add_trial_member", {
      p_trial_id: ENSAIO,
      p_user_id: OUTRA,
      p_reason: CONTEXTO_PADRAO_DA_ATRIBUICAO,
    });
  });

  it("com motivo: grava o motivo informado", async () => {
    const { db, rpc } = fakeDb([], { data: "x" });
    comoCoordenacao(db);
    await atribuirAoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA, motivo: "Reforço na colheita" }));
    expect(rpc).toHaveBeenCalledWith("admin_add_trial_member", expect.objectContaining({ p_reason: "Reforço na colheita" }));
  });

  it("pessoa não escolhida: erro no campo", async () => {
    const { db, rpc } = fakeDb();
    comoCoordenacao(db);
    const r = await atribuirAoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: "" }));
    expect(r.campos?.userId).toBe("Escolha a pessoa");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("já atribuída: conflito com mensagem clara", async () => {
    const { db } = fakeDb([], { error: { code: "23505", message: "duplicate key" } });
    comoCoordenacao(db);
    const r = await atribuirAoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA }));
    expect(r).toEqual({ status: "erro", mensagem: "Esta pessoa já está atribuída ao ensaio.", campos: undefined });
  });
});

describe("removerDoEnsaio", () => {
  it("field: negado sem tocar no banco", async () => {
    m.exigirPerfil.mockRejectedValue(new DataError("forbidden"));
    const r = await removerDoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA, motivo: "Fim", confirmar: "sim" }));
    expect(r.status).toBe("erro");
    expect(m.criarServidor).not.toHaveBeenCalled();
  });

  it("exige confirmação", async () => {
    const { db, rpc } = fakeDb();
    comoCoordenacao(db);
    const r = await removerDoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA, motivo: "Fim da avaliação" }));
    expect(r.campos?.confirmar).toBe("Confirme a retirada da pessoa");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exige motivo", async () => {
    const { db, rpc } = fakeDb();
    comoCoordenacao(db);
    const r = await removerDoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA, confirmar: "sim" }));
    expect(r.campos?.motivo).toMatch(/motivo/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("retira com motivo e confirmação", async () => {
    const { db, rpc } = fakeDb();
    comoCoordenacao(db);
    const r = await removerDoEnsaio(
      ESTADO_INICIAL,
      form({ trialId: ENSAIO, userId: OUTRA, motivo: "Fim da avaliação", confirmar: "sim" }),
    );
    expect(r).toEqual({ status: "ok", mensagem: "Pessoa retirada do ensaio." });
    expect(rpc).toHaveBeenCalledWith("admin_remove_trial_member", {
      p_trial_id: ENSAIO,
      p_user_id: OUTRA,
      p_reason: "Fim da avaliação",
    });
  });

  it("não atribuída: não encontrada", async () => {
    const { db } = fakeDb([], { error: { code: "P0002", message: "Atribuição não encontrada" } });
    comoCoordenacao(db);
    const r = await removerDoEnsaio(ESTADO_INICIAL, form({ trialId: ENSAIO, userId: OUTRA, motivo: "Fim", confirmar: "sim" }));
    expect(r).toMatchObject({ status: "erro", mensagem: "Registro não encontrado." });
  });
});
