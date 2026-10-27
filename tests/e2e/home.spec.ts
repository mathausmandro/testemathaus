import { expect, test } from "@playwright/test";

test("abre a página inicial", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Plataforma de Ensaios");
  await expect(page.getByRole("heading", { level: 1, name: "Plataforma de Ensaios" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});