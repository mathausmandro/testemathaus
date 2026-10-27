// NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
// Login e logout com usuário de teste do seed. Só roda com E2E_SUPABASE=true e o app com
// AUTH_LOCAL_PASSWORD_LOGIN=true apontando para o Supabase local (npx supabase db reset antes).
import { expect, test } from "@playwright/test";

const requerSupabase = process.env.E2E_SUPABASE !== "true";
// Senha FICTÍCIA dos usuários do seed (supabase/seed.sql); só existe no banco local.
const SENHA_DO_SEED = "senha-teste-local";

test.describe("login local com Supabase", () => {
  test.skip(requerSupabase, "requer Supabase local (defina E2E_SUPABASE=true)");

  test("entra com usuário de teste, tem cookie HttpOnly e sai", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("coordenacao@exemplo.test");
    await page.getByLabel("Senha").fill(SENHA_DO_SEED);
    await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
    await expect(page).toHaveURL(/\/inicio$/);

    const sessao = (await context.cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name));
    expect(sessao.length).toBeGreaterThan(0);
    for (const c of sessao) {
      expect(c.httpOnly).toBe(true);
      expect(c.sameSite).toBe("Lax");
    }

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name))).toEqual([]);
  });

  test("senha errada mostra mensagem genérica", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("ninguem@exemplo.test");
    await page.getByLabel("Senha").fill("errada");
    await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
  });
});
