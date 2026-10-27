// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ criar: vi.fn(), conexao: vi.fn(async () => {}) }));
vi.mock("@/lib/data/server/server-client", () => ({ createServerSupabase: m.criar }));
vi.mock("next/server", () => ({ connection: m.conexao }));

import { obterSessao } from "@/lib/data/server/session";

function cliente(user: unknown, perfil: unknown, erro: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: perfil, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: erro }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  };
}

afterEach(() => vi.clearAllMocks());

describe("obterSessao", () => {
  it("sempre aguarda a requisição (nunca congela o resultado no build)", async () => {
    m.criar.mockRejectedValue(new Error("env"));
    await obterSessao();
    expect(m.conexao).toHaveBeenCalled();
  });

  it("sem variáveis ou sem usuário: null", async () => {
    m.criar.mockRejectedValue(new Error("env"));
    expect(await obterSessao()).toBeNull();
    m.criar.mockResolvedValue(cliente(null, null, { status: 401 }));
    expect(await obterSessao()).toBeNull();
  });

  it("com usuário: devolve id, e-mail e perfil (confirmados no Auth)", async () => {
    const perfil = { id: "u1", email: "a@exemplo.test", full_name: null, role: "field", created_at: "", updated_at: "" };
    m.criar.mockResolvedValue(cliente({ id: "u1", email: "a@exemplo.test" }, perfil));
    expect(await obterSessao()).toEqual({ userId: "u1", email: "a@exemplo.test", perfil });
  });
});
