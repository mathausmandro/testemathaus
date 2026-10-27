// Login sem banco: roda em qualquer máquina (sem Supabase e sem variáveis do Microsoft).
import { expect, test } from "@playwright/test";

test("página de login com provedor ausente: botão desabilitado e aviso", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  const botao = page.getByRole("button", { name: "Entrar com a conta Microsoft" });
  await expect(botao).toBeDisabled();
  await expect(page.getByText("ainda não está configurado neste ambiente")).toBeVisible();
  await expect(page.getByLabel("Senha")).toHaveCount(0);
});

test("erro na URL só aparece como mensagem fixa", async ({ page }) => {
  await page.goto("/login?erro=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.goto("/login?erro=credenciais");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
});

test("callback rejeita retorno externo (sem open redirect)", async ({ request, baseURL }) => {
  for (const next of ["https://outro-site.example", "//outro-site.example", "/\\outro-site.example"]) {
    const r = await request.get(`/auth/callback?code=qualquer&next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
    expect(r.status()).toBe(303);
    const destino = new URL(r.headers()["location"], baseURL);
    expect(destino.origin).toBe(new URL(baseURL!).origin);
    expect(destino.host).not.toContain("outro-site");
  }
});
