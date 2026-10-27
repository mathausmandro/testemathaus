// Acesso sem sessão (roda sem banco): toda rota logada redireciona para o login.
import { expect, test } from "@playwright/test";

// Rotas existentes em src/app/(app) e (auth) que exigem sessão. tests/security/rotas-protegidas.test.ts
// confere que esta lista cobre todas as páginas protegidas.
const ROTAS_LOGADAS = ["/inicio", "/admin", "/aguardando"];

for (const rota of ROTAS_LOGADAS) {
  test(`sem sessão, ${rota} redireciona para o login`, async ({ page, request }) => {
    const r = await request.get(rota, { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers()["cache-control"]).toMatch(/no-store/);
    const destino = new URL(r.headers()["location"], "http://x");
    expect(destino.pathname).toBe("/login");

    await page.goto(rota);
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  });
}

test("rota inexistente também exige sessão (nega por padrão)", async ({ request }) => {
  const r = await request.get("/ensaios/qualquer-coisa", { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers()["location"]).toContain("/login?next=%2Fensaios%2Fqualquer-coisa");
});

test("o next do login preserva a rota pedida e o login volta para ela", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await expect(page.locator('input[name="next"]').first()).toHaveValue("/admin");
});

test("variações de caminho não escapam do proxy", async ({ request }) => {
  for (const rota of ["/inicio/", "/admin/", "/Admin", "/admin/../inicio", "/%61dmin"]) {
    const r = await request.get(rota, { maxRedirects: 0 });
    expect([307, 308, 404], rota).toContain(r.status());
    if (r.status() !== 404) expect(r.headers()["location"], rota).toMatch(/\/login|\/admin|\/inicio/);
  }
});

test("páginas públicas e arquivos estáticos continuam acessíveis", async ({ request }) => {
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/login", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/favicon.ico", { maxRedirects: 0 })).status()).toBe(200);
});

test("cookie de sessão forjado não libera acesso", async ({ request }) => {
  const r = await request.get("/inicio", {
    maxRedirects: 0,
    headers: { cookie: "sb-127-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJmYWxzbyJ9" },
  });
  expect(r.status()).toBe(307);
  expect(r.headers()["location"]).toContain("/login");
});
