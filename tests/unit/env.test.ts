import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { EnvError, parseEnv, publicEnvSchema } from "@/lib/env";
import { serverEnvSchema } from "@/lib/env.server";

const ok = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave-publicavel-de-teste",
  SUPABASE_SECRET_KEY: "chave-secreta-de-teste",
};

describe("validação de variáveis de ambiente", () => {
  it("aceita o conjunto completo", () => {
    expect(parseEnv(serverEnvSchema, ok).SUPABASE_SECRET_KEY).toBe(ok.SUPABASE_SECRET_KEY);
  });

  it("falha com mensagem clara quando falta variável", () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omit, ...falta } = ok;
    void _omit;
    expect(() => parseEnv(serverEnvSchema, falta)).toThrow(EnvError);
    expect(() => parseEnv(serverEnvSchema, falta)).toThrow(/NEXT_PUBLIC_SUPABASE_URL não definida/);
  });

  it("falha com valor vazio ou só espaços", () => {
    expect(() => parseEnv(serverEnvSchema, { ...ok, SUPABASE_SECRET_KEY: "" })).toThrow(/SUPABASE_SECRET_KEY não pode ser vazia/);
    expect(() => parseEnv(publicEnvSchema, { ...ok, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "   " })).toThrow(/não pode ser vazia/);
  });

  it("rejeita URL inválida", () => {
    expect(() => parseEnv(publicEnvSchema, { ...ok, NEXT_PUBLIC_SUPABASE_URL: "nao-e-url" })).toThrow(/URL válida/);
  });

  it("o esquema público não contém a chave secreta nem o domínio", () => {
    expect(Object.keys(publicEnvSchema.shape)).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
  });

  it("ALLOWED_EMAIL_DOMAIN é opcional (valor pendente)", () => {
    expect(parseEnv(serverEnvSchema, ok).ALLOWED_EMAIL_DOMAIN).toBeUndefined();
  });
});

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe("segredos fora do código de cliente", () => {
  const src = arquivos("src").filter((f) => !/\.test\.tsx?$/.test(f));

  it("env.server.ts exige server-only", () => {
    expect(readFileSync("src/lib/env.server.ts", "utf8")).toMatch(/^import "server-only";/m);
  });

  it("arquivos com 'use client' não importam env.server nem citam a chave secreta", () => {
    for (const f of src) {
      const txt = readFileSync(f, "utf8");
      if (/^["']use client["']/m.test(txt)) {
        expect(txt, f).not.toMatch(/env\.server/);
        expect(txt, f).not.toMatch(/SUPABASE_SECRET_KEY/);
      }
    }
  });

  it("só env.server.ts lê SUPABASE_SECRET_KEY em src", () => {
    const usam = src.filter((f) => readFileSync(f, "utf8").includes("SUPABASE_SECRET_KEY"));
    expect(usam.map((f) => f.split(sep).join("/"))).toEqual(["src/lib/env.server.ts"]);
  });

  it("env.ts (módulo de cliente) não menciona segredo", () => {
    expect(readFileSync("src/lib/env.ts", "utf8")).not.toMatch(/SUPABASE_SECRET_KEY|ALLOWED_EMAIL_DOMAIN/);
  });
});
