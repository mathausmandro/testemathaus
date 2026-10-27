// Tarefa 015: funções de administração em src/lib/data (profiles, trial-members), regras e formatação.
import { describe, expect, it, vi } from "vitest";
import {
  MENSAGEM_PROPRIO_PERFIL,
  MENSAGEM_ULTIMA_COORDENACAO,
  verificarMudancaDePerfil,
} from "@/lib/auth/regras-de-perfil";
import { traduzirErro } from "@/lib/data/errors";
import {
  countCoordination,
  definirPerfilSchema,
  listProfiles,
  listRoleHistory,
  pessoaAfetada,
  setUserRole,
} from "@/lib/data/profiles";
import {
  CONTEXTO_PADRAO_DA_ATRIBUICAO,
  addTrialMember,
  atribuirMembroSchema,
  listTrialMemberHistory,
  listTrialMembers,
  removeTrialMember,
} from "@/lib/data/trial-members";
import type { DbClient } from "@/lib/data/types";
import { formatarDataHora, nomeDaPessoa } from "@/lib/format";

type Resultado = { data?: unknown; error?: unknown; count?: number | null };

function fakeDb(fila: Resultado[] = [], rpcResultado: Resultado = {}) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const from = vi.fn((tabela: string) => {
    const resultado = { data: null, error: null, count: null, ...(fila.shift() ?? {}) };
    const cadeia: unknown = new Proxy(
      {},
      {
        get(_t, metodo: string) {
          if (metodo === "then") return (res: (v: Resultado) => unknown) => Promise.resolve(resultado).then(res);
          return (...args: unknown[]) => {
            chamadas.push({ tabela, metodo, args });
            return cadeia;
          };
        },
      },
    );
    return cadeia;
  });
  const rpc = vi.fn(async () => ({ data: null, error: null, ...rpcResultado }));
  return { db: { from, rpc } as unknown as DbClient, from, rpc, chamadas };
}

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const T1 = "33333333-3333-4333-8333-333333333333";

describe("verificarMudancaDePerfil", () => {
  const base = { atorId: U1, alvoId: U2, papelAtual: "field" as const, novoPapel: "home_office" as const, totalCoordenacao: 1 };
  it("permite mudar o perfil de outra pessoa", () => expect(verificarMudancaDePerfil(base)).toBeNull());
  it("recusa mudar o próprio perfil", () =>
    expect(verificarMudancaDePerfil({ ...base, alvoId: U1 })).toBe(MENSAGEM_PROPRIO_PERFIL));
  it("recusa tirar a última coordenação", () =>
    expect(verificarMudancaDePerfil({ ...base, papelAtual: "coordination", novoPapel: null, totalCoordenacao: 1 })).toBe(
      MENSAGEM_ULTIMA_COORDENACAO,
    ));
  it("recusa mesmo com contagem zerada (dado inconsistente)", () =>
    expect(verificarMudancaDePerfil({ ...base, papelAtual: "coordination", totalCoordenacao: 0 })).toBe(MENSAGEM_ULTIMA_COORDENACAO));
  it("permite rebaixar uma coordenação quando sobra outra", () =>
    expect(verificarMudancaDePerfil({ ...base, papelAtual: "coordination", novoPapel: "field", totalCoordenacao: 2 })).toBeNull());
  it("promover alguém nunca esbarra na regra da última coordenação", () =>
    expect(verificarMudancaDePerfil({ ...base, papelAtual: null, novoPapel: "coordination", totalCoordenacao: 1 })).toBeNull());
  it("sem mudança, nada a recusar (nem para si)", () =>
    expect(verificarMudancaDePerfil({ ...base, alvoId: U1, papelAtual: "coordination", novoPapel: "coordination" })).toBeNull());
});

describe("definirPerfilSchema", () => {
  it.each(["admin", "COORDINATION", "", "superuser"])("rejeita o perfil %j", (role) => {
    expect(definirPerfilSchema.safeParse({ userId: U1, role, reason: "Motivo ok" }).success).toBe(false);
  });
  it("aceita os três perfis e null (revogação)", () => {
    for (const role of ["coordination", "field", "home_office", null]) {
      expect(definirPerfilSchema.safeParse({ userId: U1, role, reason: "Motivo ok" }).success).toBe(true);
    }
  });
  it("motivo: 3 a 500 caracteres depois de aparar", () => {
    expect(definirPerfilSchema.safeParse({ userId: U1, role: "field", reason: "  ab  " }).success).toBe(false);
    expect(definirPerfilSchema.safeParse({ userId: U1, role: "field", reason: "x".repeat(501) }).success).toBe(false);
    expect(definirPerfilSchema.parse({ userId: U1, role: "field", reason: "  abc  " }).reason).toBe("abc");
  });
});

describe("listProfiles", () => {
  it("pagina no banco, sem perfil primeiro, com contagem exata", async () => {
    const { db, chamadas } = fakeDb([{ data: [], count: 60 }]);
    const r = await listProfiles(db, { pagina: "3", filtro: "todos" });
    expect(r).toMatchObject({ total: 60, pagina: 3, porPagina: 25, filtro: "todos" });
    expect(chamadas).toContainEqual({ tabela: "profiles", metodo: "range", args: [50, 74] });
    expect(chamadas).toContainEqual({ tabela: "profiles", metodo: "order", args: ["role", { ascending: true, nullsFirst: true }] });
    expect(chamadas.find((c) => c.metodo === "select")?.args[1]).toEqual({ count: "exact" });
    expect(chamadas.some((c) => c.metodo === "is")).toBe(false);
  });

  it("filtro sem perfil e entradas absurdas voltam ao padrão", async () => {
    const { db, chamadas } = fakeDb([{ data: [] }]);
    const r = await listProfiles(db, { pagina: "-5", porPagina: "100000", filtro: "sem_perfil" });
    expect(r).toMatchObject({ pagina: 1, porPagina: 25, filtro: "sem_perfil" });
    expect(chamadas).toContainEqual({ tabela: "profiles", metodo: "is", args: ["role", null] });
    const { db: db2 } = fakeDb([{ data: [] }]);
    expect((await listProfiles(db2, { filtro: "drop table" })).filtro).toBe("todos");
  });

  it("página além do fim: lista vazia, sem erro", async () => {
    const { db } = fakeDb([{ error: { code: "PGRST103", message: "range" } }]);
    await expect(listProfiles(db, { pagina: 99 })).resolves.toMatchObject({ itens: [] });
  });

  it("erro do banco vira DataError", async () => {
    const { db } = fakeDb([{ error: { code: "42501" } }]);
    await expect(listProfiles(db)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("countCoordination e setUserRole", () => {
  it("conta só coordination, sem trazer linhas", async () => {
    const { db, chamadas } = fakeDb([{ count: 2 }]);
    await expect(countCoordination(db)).resolves.toBe(2);
    expect(chamadas).toContainEqual({ tabela: "profiles", metodo: "select", args: ["id", { count: "exact", head: true }] });
    expect(chamadas).toContainEqual({ tabela: "profiles", metodo: "eq", args: ["role", "coordination"] });
  });

  it("chama a RPC com motivo e não chama com entrada inválida", async () => {
    const { db, rpc } = fakeDb();
    await setUserRole(db, { userId: U2, role: null, reason: "Saiu da equipe" });
    expect(rpc).toHaveBeenCalledWith("admin_set_user_role", { p_user_id: U2, p_role: null, p_reason: "Saiu da equipe" });
    rpc.mockClear();
    await expect(setUserRole(db, { userId: U2, role: "root" as never, reason: "x" })).rejects.toMatchObject({ code: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("histórico", () => {
  it("pessoa afetada: perfil pelo record_id, membro pelo user_id", () => {
    expect(pessoaAfetada({ table_name: "profiles", record_id: U1, old_value: null, new_value: null })).toBe(U1);
    expect(pessoaAfetada({ table_name: "trial_members", record_id: T1, old_value: { user_id: U2 }, new_value: null })).toBe(U2);
  });

  it("listRoleHistory traz nomes de autor e pessoa numa consulta extra", async () => {
    const linha = {
      id: "h1",
      table_name: "profiles",
      operation: "UPDATE",
      record_id: U2,
      trial_id: null,
      author_id: U1,
      changed_at: "2026-10-27T15:00:00Z",
      reason: "Liberação",
      old_value: { role: null },
      new_value: { role: "field" },
    };
    const nomes = [
      { id: U1, email: "c@exemplo.test", full_name: "Coord", role: "coordination" },
      { id: U2, email: "p@exemplo.test", full_name: null, role: "field" },
    ];
    const { db, chamadas, from } = fakeDb([{ data: [linha] }, { data: nomes }]);
    const [item] = await listRoleHistory(db, { userId: U2, limite: 5 });
    expect(item).toMatchObject({ reason: "Liberação", papelAnterior: null, papelNovo: "field" });
    expect(item.autor?.full_name).toBe("Coord");
    expect(item.pessoa?.email).toBe("p@exemplo.test");
    expect(from).toHaveBeenCalledTimes(2);
    expect(chamadas).toContainEqual({ tabela: "change_history", metodo: "eq", args: ["table_name", "profiles"] });
    expect(chamadas).toContainEqual({ tabela: "change_history", metodo: "eq", args: ["record_id", U2] });
    expect(chamadas).toContainEqual({ tabela: "change_history", metodo: "limit", args: [5] });
  });

  it("listRoleHistory sem linhas não consulta nomes; id inválido é rejeitado", async () => {
    const { db, from } = fakeDb([{ data: [] }]);
    await expect(listRoleHistory(db)).resolves.toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
    await expect(listRoleHistory(db, { userId: "x" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("listTrialMemberHistory filtra pelo ensaio", async () => {
    const { db, chamadas } = fakeDb([{ data: [] }]);
    await listTrialMemberHistory(db, T1, 10);
    expect(chamadas).toContainEqual({ tabela: "change_history", metodo: "eq", args: ["table_name", "trial_members"] });
    expect(chamadas).toContainEqual({ tabela: "change_history", metodo: "eq", args: ["trial_id", T1] });
  });
});

describe("trial-members", () => {
  it("lista membros com a pessoa (junção pela FK)", async () => {
    const pessoa = { id: U2, email: "p@exemplo.test", full_name: "P", role: "field" };
    const { db, chamadas } = fakeDb([{ data: [{ id: "m1", trial_id: T1, user_id: U2, created_at: "c", pessoa }] }]);
    await expect(listTrialMembers(db, T1)).resolves.toEqual([{ id: "m1", trialId: T1, userId: U2, createdAt: "c", pessoa }]);
    expect(String(chamadas.find((c) => c.metodo === "select")?.args[0])).toContain("profiles!trial_members_user_id_fkey");
  });

  it("contexto padrão quando o motivo falta ou é curto demais", () => {
    expect(atribuirMembroSchema.parse({ trialId: T1, userId: U2 }).reason).toBe(CONTEXTO_PADRAO_DA_ATRIBUICAO);
    expect(atribuirMembroSchema.parse({ trialId: T1, userId: U2, reason: " a " }).reason).toBe(CONTEXTO_PADRAO_DA_ATRIBUICAO);
    expect(atribuirMembroSchema.parse({ trialId: T1, userId: U2, reason: "Colheita" }).reason).toBe("Colheita");
  });

  it("add e remove chamam as RPCs; entradas inválidas não chegam ao banco", async () => {
    const { db, rpc } = fakeDb([], { data: "m1" });
    await expect(addTrialMember(db, { trialId: T1, userId: U2 })).resolves.toBe("m1");
    await removeTrialMember(db, { trialId: T1, userId: U2, reason: "Fim" });
    expect(rpc).toHaveBeenNthCalledWith(2, "admin_remove_trial_member", { p_trial_id: T1, p_user_id: U2, p_reason: "Fim" });
    rpc.mockClear();
    await expect(removeTrialMember(db, { trialId: T1, userId: U2, reason: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(addTrialMember(db, { trialId: "x", userId: U2 })).rejects.toMatchObject({ code: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("erros das RPCs", () => {
  it("P0002 vira não encontrado e 22023 vira inválido", () => {
    expect(traduzirErro({ code: "P0002" }).code).toBe("not_found");
    expect(traduzirErro({ code: "22023" }).code).toBe("invalid");
  });
});

describe("formatação", () => {
  it("data e hora em America/Sao_Paulo", () => {
    expect(formatarDataHora("2026-10-27T15:30:00Z")).toBe("27/10/2026, 12:30");
    expect(formatarDataHora(null)).toBe("—");
    expect(formatarDataHora("lixo")).toBe("—");
  });
  it("nome ou e-mail", () => {
    expect(nomeDaPessoa({ full_name: "  ", email: "a@exemplo.test" })).toBe("a@exemplo.test");
    expect(nomeDaPessoa({ full_name: "Ana", email: "a@exemplo.test" })).toBe("Ana");
    expect(nomeDaPessoa(null)).toBe("Pessoa removida");
  });
});
