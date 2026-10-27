import { describe, expect, it, vi } from "vitest";
import { DataError, traduzirErro } from "@/lib/data/errors";
import { getOwnProfile } from "@/lib/data/profiles";
import { createTrial, getTrial, listTrials } from "@/lib/data/trials";
import type { DbClient } from "@/lib/data/types";

type Resultado = { data: unknown; error: unknown };

/** Cliente Supabase simulado: qualquer cadeia de métodos termina no resultado informado. */
function fakeDb(resultado: Resultado, user: { id: string } | null = { id: "u1" }) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
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
  const from = vi.fn((tabela: string) => {
    chamadas.push({ metodo: "from", args: [tabela] });
    return cadeia;
  });
  const getUser = vi.fn(async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "jwt" } }));
  return { db: { from, auth: { getUser } } as unknown as DbClient, from, getUser, chamadas };
}

const erroRls = { code: "42501", message: 'new row violates row-level security policy for table "trials"' };

describe("traduzirErro", () => {
  it.each([
    ["42501", "forbidden"],
    ["PGRST116", "not_found"],
    ["23505", "conflict"],
    ["23514", "invalid"],
    ["XX000", "internal"],
  ])("mapeia %s para %s", (code, esperado) => {
    expect(traduzirErro({ code }).code).toBe(esperado);
  });

  it("mapeia status HTTP", () => {
    expect(traduzirErro({ status: 401 }).code).toBe("unauthenticated");
    expect(traduzirErro({ status: 503 }).code).toBe("unavailable");
    expect(traduzirErro(null).code).toBe("internal");
  });

  it("não vaza detalhes do banco na mensagem", () => {
    const e = traduzirErro({ code: "23505", message: 'duplicate key value violates unique constraint "trials_code_key"' });
    expect(e.message).toBe("Já existe um registro com estes dados.");
    expect(e.message).not.toMatch(/trials|constraint|key|policy|row-level/i);
  });
});

describe("profiles", () => {
  it("devolve o próprio perfil", async () => {
    const perfil = { id: "u1", email: "a@b.c", full_name: null, role: "field", created_at: "", updated_at: "" };
    const { db, chamadas } = fakeDb({ data: perfil, error: null });
    await expect(getOwnProfile(db)).resolves.toEqual(perfil);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", "u1"] });
  });

  it("sem sessão lança unauthenticated e não consulta o banco", async () => {
    const { db, from } = fakeDb({ data: null, error: null }, null);
    await expect(getOwnProfile(db)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("trials", () => {
  it("lista em uma única consulta (sem N+1)", async () => {
    const { db, from } = fakeDb({ data: [{ id: "1" }, { id: "2" }], error: null });
    await expect(listTrials(db)).resolves.toHaveLength(2);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("trials");
  });

  it("traduz erro da listagem", async () => {
    const { db } = fakeDb({ data: null, error: { code: "XX000", message: "segredo interno" } });
    const e = await listTrials(db).catch((x) => x);
    expect(e).toBeInstanceOf(DataError);
    expect(e.message).not.toContain("segredo");
  });

  it("getTrial rejeita id inválido sem consultar", async () => {
    const { db, from } = fakeDb({ data: null, error: null });
    await expect(getTrial(db, "abc")).rejects.toMatchObject({ code: "invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("getTrial devolve null quando a RLS esconde o ensaio", async () => {
    const { db } = fakeDb({ data: null, error: null });
    await expect(getTrial(db, "7b0f5d1e-3c1a-4b8e-9f3a-1d2e3f4a5b6c")).resolves.toBeNull();
  });

  it("createTrial valida a entrada com zod antes de gravar", async () => {
    const { db, from } = fakeDb({ data: null, error: null });
    const e = await createTrial(db, { code: "  " }).catch((x) => x);
    expect(e).toMatchObject({ code: "invalid" });
    expect(e.fields.code).toBe("Informe o código do ensaio");
    expect(from).not.toHaveBeenCalled();
  });

  it("createTrial recusa data final anterior à inicial e delineamento desconhecido", async () => {
    const { db } = fakeDb({ data: null, error: null });
    const e1 = await createTrial(db, { code: "E1", planned_start_date: "2026-10-10", planned_end_date: "2026-10-01" }).catch((x) => x);
    expect(e1.fields.planned_end_date).toMatch(/anterior/);
    // @ts-expect-error valor fora do enum
    const e2 = await createTrial(db, { code: "E1", design: "xyz" }).catch((x) => x);
    expect(e2.fields.design).toBe("Delineamento inválido");
  });

  it("createTrial normaliza texto e envia só campos conhecidos", async () => {
    const { db, chamadas } = fakeDb({ data: { id: "1", code: "E1" }, error: null });
    await createTrial(db, { code: " E1 ", crop: "  ", status: "completed" } as never);
    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.args[0]).toEqual({ code: "E1", crop: null });
  });

  it("perfil sem permissão (field/home_office) recebe forbidden sem detalhes internos", async () => {
    const { db } = fakeDb({ data: null, error: erroRls });
    const e = await createTrial(db, { code: "E1" }).catch((x) => x);
    expect(e).toBeInstanceOf(DataError);
    expect(e.code).toBe("forbidden");
    expect(e.message).toBe("Você não tem permissão para esta ação.");
    expect(e.message).not.toMatch(/row-level|trials|policy/i);
  });
});
