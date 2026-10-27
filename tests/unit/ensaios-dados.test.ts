// @vitest-environment node
// Tarefa 016: leitura do protocolo (src/lib/data/protocol.ts) e formatações das telas de ensaios.
import { describe, expect, it, vi } from "vitest";
import { listPlots, listTreatments, type TratamentoResumo } from "@/lib/data/protocol";
import type { DbClient } from "@/lib/data/types";
import { ehEnsaioDeTeste, formatarData, nomeDoDelineamento } from "@/lib/format";

const TRIAL = "7b0f5d1e-3c1a-4b8e-9f3a-1d2e3f4a5b6c";

function fakeDb(resultado: { data: unknown; error: unknown }) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const cadeia: unknown = new Proxy(
    {},
    {
      get(_t, metodo: string) {
        if (metodo === "then") return (res: (v: unknown) => unknown) => Promise.resolve(resultado).then(res);
        return (...args: unknown[]) => {
          chamadas.push({ metodo, args });
          return cadeia;
        };
      },
    },
  );
  const from = vi.fn((t: string) => {
    chamadas.push({ metodo: "from", args: [t] });
    return cadeia;
  });
  return { db: { from } as unknown as DbClient, from, chamadas };
}

const trat = (id: string, number: number, name: string): TratamentoResumo => ({
  id,
  number,
  name,
  product: null,
  dose: null,
  dose_unit: null,
  timing: null,
});

describe("protocolo (somente leitura)", () => {
  it("rejeita id de ensaio inválido sem consultar", async () => {
    const { db, from } = fakeDb({ data: [], error: null });
    await expect(listTreatments(db, "1 or 1=1")).rejects.toMatchObject({ code: "invalid" });
    await expect(listPlots(db, "abc", [])).rejects.toMatchObject({ code: "invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("lista tratamentos do ensaio ordenados por número", async () => {
    const { db, chamadas } = fakeDb({ data: [], error: null });
    await listTreatments(db, TRIAL);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["trial_id", TRIAL] });
    expect(chamadas).toContainEqual({ metodo: "order", args: ["number", { ascending: true }] });
  });

  it("junta o tratamento a cada parcela em memória (uma consulta, sem N+1)", async () => {
    const { db, from } = fakeDb({
      data: [
        { id: "p1", number: 101, block: 1, grid_row: 1, grid_column: 1, treatment_id: "t2" },
        { id: "p2", number: 102, block: 1, grid_row: 1, grid_column: 2, treatment_id: null },
      ],
      error: null,
    });
    const r = await listPlots(db, TRIAL, [trat("t1", 1, "Testemunha"), trat("t2", 2, "Produto A")]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(r[0].treatment).toEqual({ number: 2, name: "Produto A" });
    expect(r[1].treatment).toBeNull();
  });

  it("traduz erro do banco sem vazar detalhe", async () => {
    const { db } = fakeDb({ data: null, error: { code: "XX000", message: "segredo interno" } });
    const e = await listTreatments(db, TRIAL).catch((x) => x);
    expect(e.message).not.toContain("segredo");
  });
});

describe("formatação das telas de ensaios", () => {
  it("formata data sem deslocar o dia por fuso", () => {
    expect(formatarData("2026-11-01")).toBe("01/11/2026");
    expect(formatarData(null)).toBe("—");
    expect(formatarData("lixo")).toBe("—");
  });

  it("nomeia os delineamentos conhecidos", () => {
    expect(nomeDoDelineamento("dbc")).toBe("Blocos casualizados (DBC)");
    expect(nomeDoDelineamento("outro")).toBe("—");
    expect(nomeDoDelineamento(null)).toBe("—");
  });

  it("marca só os ensaios do seed como de teste", () => {
    expect(ehEnsaioDeTeste("ENS-TESTE-01")).toBe(true);
    expect(ehEnsaioDeTeste("ENS-2027-001")).toBe(false);
  });
});
