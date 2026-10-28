// @vitest-environment node
// Tarefa 017: utilitário compartilhado de validação das Server Actions e Route Handlers.
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { DataError } from "@/lib/data/errors";
import {
  falhaDe,
  lerFormulario,
  lerParametros,
  LIMITE_DO_CAMPO,
  MENSAGEM_CAMPOS_INVALIDOS,
  MENSAGEM_ERRO_GENERICO,
  renomearCampos,
  validarEntrada,
  validarFormulario,
} from "@/lib/validation";

const schema = z.object({
  nome: z.string({ error: "Informe o nome" }).trim().min(2, "Nome curto demais"),
  idade: z.coerce.number({ error: "Idade inválida" }).int("Idade inválida").min(0, "Idade inválida").optional(),
});

const form = (dados: Record<string, string | Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(dados)) f.set(k, v);
  return f;
};

describe("validarEntrada", () => {
  it("devolve os dados já transformados", () => {
    expect(validarEntrada(schema, { nome: "  Ana ", idade: "30" })).toEqual({ nome: "Ana", idade: 30 });
  });

  it("entrada inválida: DataError invalid com mensagens por campo em português", () => {
    try {
      validarEntrada(schema, { nome: "A", idade: "-1" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DataError);
      expect((e as DataError).code).toBe("invalid");
      expect((e as DataError).fields).toEqual({ nome: "Nome curto demais", idade: "Idade inválida" });
      expect((e as DataError).message).toBe("Os dados informados são inválidos.");
    }
  });

  it("entrada que nem é objeto também vira erro padronizado", () => {
    expect(() => validarEntrada(schema, "lixo")).toThrow(DataError);
    expect(() => validarEntrada(schema, null)).toThrow(DataError);
  });
});

describe("lerFormulario e lerParametros", () => {
  it("lê só os campos listados e ignora o resto", () => {
    const f = form({ nome: "Ana", role: "coordination", extra: "x" });
    expect(lerFormulario(f, ["nome"])).toEqual({ nome: "Ana" });
  });

  it("arquivo enviado no lugar de texto vira ausente", () => {
    const f = form({ nome: new Blob(["x"]) });
    expect(lerFormulario(f, ["nome"])).toEqual({ nome: undefined });
  });

  it("campo grande demais vira ausente antes do schema", () => {
    const f = form({ nome: "a".repeat(LIMITE_DO_CAMPO + 1) });
    expect(lerFormulario(f, ["nome"]).nome).toBeUndefined();
  });

  it("vazioComoAusente trata campo em branco como não informado", () => {
    const f = form({ nome: "   " });
    expect(lerFormulario(f, ["nome"])).toEqual({ nome: "   " });
    expect(lerFormulario(f, ["nome"], { vazioComoAusente: true })).toEqual({ nome: undefined });
  });

  it("lerParametros faz o mesmo com a query string", () => {
    expect(lerParametros(new URLSearchParams("code=abc&x=1"), ["code", "next"])).toEqual({ code: "abc", next: undefined });
  });

  it("validarFormulario lê e valida de uma vez", () => {
    expect(validarFormulario(schema, form({ nome: "Bia", idade: "" }), ["nome", "idade"], { vazioComoAusente: true })).toEqual({ nome: "Bia" });
    expect(() => validarFormulario(schema, form({}), ["nome"])).toThrow(DataError);
  });
});

describe("falhaDe: erro padronizado sem vazar detalhes", () => {
  it("entrada inválida: mensagem fixa e campos", () => {
    expect(falhaDe(new DataError("invalid", { nome: "Informe o nome" }))).toEqual({
      status: "erro",
      mensagem: MENSAGEM_CAMPOS_INVALIDOS,
      campos: { nome: "Informe o nome" },
    });
  });

  it("DataError com causa do banco: só a mensagem genérica, sem a causa", () => {
    const e = new DataError("forbidden", undefined, { cause: { message: 'permission denied for table "trials"', code: "42501" } });
    const r = falhaDe(e);
    expect(r).toEqual({ status: "erro", mensagem: "Você não tem permissão para esta ação.", campos: undefined });
    expect(JSON.stringify(r)).not.toMatch(/trials|42501|permission/);
  });

  it("erro inesperado (com stack, SQL, ZodError): mensagem genérica, sem stack", () => {
    for (const e of [new Error("select * from profiles where ..."), new TypeError("x is undefined"), z.string().safeParse(1).error, "texto"]) {
      const r = falhaDe(e);
      expect(r).toEqual({ status: "erro", mensagem: MENSAGEM_ERRO_GENERICO });
      expect(JSON.stringify(r)).not.toMatch(/at |select|profiles|undefined|expected/);
    }
  });

  it("renomearCampos troca os nomes da camada de dados pelos do formulário", () => {
    const e = renomearCampos(new DataError("invalid", { reason: "Informe o motivo", userId: "Pessoa inválida" }), { reason: "motivo" });
    expect(e.fields).toEqual({ motivo: "Informe o motivo", userId: "Pessoa inválida" });
  });
});
