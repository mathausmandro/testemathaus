// @vitest-environment node
// Tarefa 016: Server Action criarEnsaio chamada direto (sem tela), com cliente Supabase simulado.
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataError } from "@/lib/data/errors";

const m = vi.hoisted(() => ({
  exigirPerfil: vi.fn(),
  criarServidor: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
vi.mock("@/lib/auth/server", () => ({ exigirPerfil: m.exigirPerfil }));
vi.mock("@/lib/data/server/server-client", () => ({ createServerSupabase: m.criarServidor }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { ESTADO_INICIAL } from "@/app/(app)/admin/estado";
import { criarEnsaio } from "@/app/(app)/ensaios/actions";

const ID = "33333333-3333-4333-8333-333333333333";

function fakeDb(resultado: { data?: unknown; error?: unknown }) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const cadeia: unknown = new Proxy(
    {},
    {
      get(_t, metodo: string) {
        if (metodo === "then") return undefined;
        return (...args: unknown[]) => {
          chamadas.push({ metodo, args });
          return metodo === "single" ? Promise.resolve({ data: null, error: null, ...resultado }) : cadeia;
        };
      },
    },
  );
  const from = vi.fn(() => cadeia);
  return { db: { from }, from, chamadas };
}

const form = (dados: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(dados)) f.set(k, v);
  return f;
};

afterEach(() => vi.clearAllMocks());

describe("criarEnsaio", () => {
  it.each([
    ["field", new DataError("forbidden"), "Você não tem permissão para esta ação."],
    ["sem sessão", new DataError("unauthenticated"), "Sua sessão expirou. Entre novamente."],
  ])("%s: negado no servidor, sem tocar no banco", async (_nome, erro, mensagem) => {
    m.exigirPerfil.mockRejectedValue(erro);
    const r = await criarEnsaio(ESTADO_INICIAL, form({ code: "ENS-1" }));
    expect(r).toMatchObject({ status: "erro", mensagem });
    expect(m.exigirPerfil).toHaveBeenCalledWith(["coordination"]);
    expect(m.criarServidor).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("código vazio: erro no campo e nada é gravado", async () => {
    const { db, from } = fakeDb({});
    m.exigirPerfil.mockResolvedValue({});
    m.criarServidor.mockResolvedValue(db);
    const r = await criarEnsaio(ESTADO_INICIAL, form({ code: "   ", crop: "Soja" }));
    expect(r.status).toBe("erro");
    expect(r.mensagem).toBe("Corrija os campos destacados.");
    expect(r.campos?.code).toBe("Informe o código do ensaio");
    expect(from).not.toHaveBeenCalled();
  });

  it("datas incoerentes: erro no campo da data final e nada é gravado", async () => {
    const { db, from } = fakeDb({});
    m.exigirPerfil.mockResolvedValue({});
    m.criarServidor.mockResolvedValue(db);
    const r = await criarEnsaio(ESTADO_INICIAL, form({ code: "E1", planned_start_date: "2027-02-10", planned_end_date: "2027-02-01" }));
    expect(r.campos?.planned_end_date).toBe("A data final não pode ser anterior à inicial");
    expect(from).not.toHaveBeenCalled();
  });

  it("delineamento fora da lista é rejeitado; vazio vale como não definido", async () => {
    const { db, from, chamadas } = fakeDb({ data: { id: ID } });
    m.exigirPerfil.mockResolvedValue({});
    m.criarServidor.mockResolvedValue(db);
    const ruim = await criarEnsaio(ESTADO_INICIAL, form({ code: "E1", design: "xyz" }));
    expect(ruim.campos?.design).toBe("Delineamento inválido");
    expect(from).not.toHaveBeenCalled();

    await expect(criarEnsaio(ESTADO_INICIAL, form({ code: "E1", design: "", planned_start_date: "" }))).rejects.toThrow(`REDIRECT:/ensaios/${ID}`);
    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.args[0]).toEqual({ code: "E1" });
  });

  it("sucesso: grava, atualiza a lista e redireciona para o detalhe", async () => {
    const { db, from } = fakeDb({ data: { id: ID } });
    m.exigirPerfil.mockResolvedValue({});
    m.criarServidor.mockResolvedValue(db);
    await expect(criarEnsaio(ESTADO_INICIAL, form({ code: " ENS-9 ", crop: "Soja", design: "dbc" }))).rejects.toThrow(`REDIRECT:/ensaios/${ID}`);
    expect(from).toHaveBeenCalledWith("trials");
    expect(m.revalidatePath).toHaveBeenCalledWith("/ensaios");
  });

  it("código repetido vira erro no campo, sem detalhe do banco", async () => {
    const { db } = fakeDb({ error: { code: "23505", message: 'duplicate key ... "trials_code_key"' } });
    m.exigirPerfil.mockResolvedValue({});
    m.criarServidor.mockResolvedValue(db);
    const r = await criarEnsaio(ESTADO_INICIAL, form({ code: "ENS-TESTE-01" }));
    expect(r.campos?.code).toBe("Já existe um ensaio com este código");
    expect(JSON.stringify(r)).not.toMatch(/trials_code_key|duplicate/);
  });

  it("RLS nega (perfil sem permissão no banco): mensagem genérica de permissão", async () => {
    const { db } = fakeDb({ error: { code: "42501", message: "new row violates row-level security policy" } });
    m.exigirPerfil.mockResolvedValue({});
    m.criarServidor.mockResolvedValue(db);
    const r = await criarEnsaio(ESTADO_INICIAL, form({ code: "E1" }));
    expect(r).toMatchObject({ status: "erro", mensagem: "Você não tem permissão para esta ação." });
  });
});
