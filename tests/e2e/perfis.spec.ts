// NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
// Um fluxo por situação: sem perfil, coordination, field e home_office (usuários fictícios do seed).
// Rodar com: npx supabase db reset; .env.local com AUTH_LOCAL_PASSWORD_LOGIN=true; npm run build;
//            E2E_SUPABASE=true npx playwright test tests/e2e/perfis.spec.ts
import { expect, test, type Page } from "@playwright/test";

const SENHA_DO_SEED = "senha-teste-local"; // fictícia, só no banco local (supabase/seed.sql)

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA_DO_SEED);
  await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
}

test.describe("acesso por perfil com Supabase local", () => {
  test.skip(process.env.E2E_SUPABASE !== "true", "requer Supabase local (defina E2E_SUPABASE=true)");

  test("sem perfil: só vê Aguardando liberação, qualquer rota volta para ela", async ({ page }) => {
    await entrar(page, "aguardando@exemplo.test");
    await expect(page).toHaveURL(/\/aguardando$/);
    await expect(page.getByRole("heading", { level: 1, name: "Aguardando liberação de acesso" })).toBeVisible();
    for (const rota of ["/inicio", "/admin", "/ensaios", "/login"]) {
      await page.goto(rota);
      await expect(page, rota).toHaveURL(/\/aguardando$/);
    }
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("coordination: início e administração", async ({ page }) => {
    await entrar(page, "coordenacao@exemplo.test");
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByText("Seu perfil: Coordenação.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Administração" })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Administração" })).toBeVisible();
    await page.goto("/aguardando");
    await expect(page).toHaveURL(/\/inicio$/);
  });

  for (const [email, nome] of [
    ["campo@exemplo.test", "Campo"],
    ["escritorio@exemplo.test", "Home office"],
  ] as const) {
    test(`${nome}: início sim, administração negada no servidor`, async ({ page, request }) => {
      await entrar(page, email);
      await expect(page).toHaveURL(/\/inicio$/);
      await expect(page.getByText(`Seu perfil: ${nome}.`)).toBeVisible();
      await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/inicio$/);
      await expect(page.getByRole("heading", { name: "Administração" })).toHaveCount(0);

      // Requisição direta com os mesmos cookies, sem passar pela navegação.
      const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const r = await request.get("/admin", { maxRedirects: 0, headers: { cookie: cookies } });
      expect(r.status()).toBe(307);
      expect(r.headers()["location"]).toContain("/inicio");
    });
  }

  test("página autenticada não vai para cache compartilhado", async ({ page }) => {
    await entrar(page, "coordenacao@exemplo.test");
    const resposta = await page.goto("/inicio");
    expect(resposta?.headers()["cache-control"]).toMatch(/private|no-store/);
  });
});
