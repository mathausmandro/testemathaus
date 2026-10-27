// NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
// Tarefa 013: cadastro com e-mail fora do domínio é recusado pelo hook e não cria usuário.
// Pré-requisitos: npx supabase db reset (seed liga o modo local), E2E_SUPABASE=true e .env.local
// com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY do Supabase local.
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

test.describe("hook de domínio no Supabase local", () => {
  test.skip(process.env.E2E_SUPABASE !== "true", "requer Supabase local (defina E2E_SUPABASE=true)");

  const cabecalhos = { apikey: CHAVE, "Content-Type": "application/json" };
  const senha = "senha-teste-local-hook";

  test("e-mail de outro domínio é recusado e não consegue entrar depois", async ({ request }) => {
    const email = `fora-${Date.now()}@outro-dominio.test`;
    const cadastro = await request.post(`${URL_SUPABASE}/auth/v1/signup`, { headers: cabecalhos, data: { email, password: senha } });
    expect(cadastro.ok()).toBe(false);
    const corpo = await cadastro.text();
    expect(corpo).toContain("Cadastro não permitido");

    // Nenhum usuário foi criado: o login com a mesma senha falha.
    const login = await request.post(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
      headers: cabecalhos,
      data: { email, password: senha },
    });
    expect(login.ok()).toBe(false);
  });

  test("com o modo local, o domínio reservado exemplo.test é aceito", async ({ request }) => {
    const email = `novo-${Date.now()}@exemplo.test`;
    const cadastro = await request.post(`${URL_SUPABASE}/auth/v1/signup`, { headers: cabecalhos, data: { email, password: senha } });
    expect(cadastro.ok()).toBe(true);
  });
});
