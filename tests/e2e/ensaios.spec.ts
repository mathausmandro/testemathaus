// NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
// Tarefa 016: um fluxo por situação (sem perfil, coordination, field, home_office) nas telas de ensaios.
// Usa os ensaios fictícios do seed: ENS-TESTE-01 (field e home_office atribuídos) e ENS-TESTE-02 (ninguém).
// Altera o banco (cria um ensaio): rode depois de `npx supabase db reset`.
// Rodar com: .env.local com AUTH_LOCAL_PASSWORD_LOGIN=true; npm run build;
//            E2E_SUPABASE=true npx playwright test tests/e2e/ensaios.spec.ts
import { expect, test, type Page } from "@playwright/test";

const SENHA_DO_SEED = "senha-teste-local"; // fictícia, só no banco local (supabase/seed.sql)
const ATRIBUIDO = { id: "20000000-0000-4000-8000-000000000001", codigo: "ENS-TESTE-01" };
const NAO_ATRIBUIDO = { id: "20000000-0000-4000-8000-000000000002", codigo: "ENS-TESTE-02" };

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA_DO_SEED);
  await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
}

test.describe("ensaios com Supabase local", () => {
  test.skip(process.env.E2E_SUPABASE !== "true", "requer Supabase local (defina E2E_SUPABASE=true)");

  test("sem perfil: nenhuma página de ensaios, tudo volta para Aguardando liberação", async ({ page }) => {
    await entrar(page, "aguardando@exemplo.test");
    for (const rota of ["/ensaios", `/ensaios/${ATRIBUIDO.id}`, "/ensaios/novo"]) {
      await page.goto(rota);
      await expect(page, rota).toHaveURL(/\/aguardando$/);
    }
  });

  test("coordination: vê todos, abre o detalhe com parcelas e cria um ensaio", async ({ page }) => {
    await entrar(page, "coordenacao@exemplo.test");
    await page.goto("/ensaios");
    const lista = page.getByRole("list", { name: "Lista de ensaios" });
    await expect(lista).toContainText(ATRIBUIDO.codigo);
    await expect(lista).toContainText(NAO_ATRIBUIDO.codigo);
    await expect(lista.getByText("Ensaio de teste · dados fictícios").first()).toBeVisible();

    await page.getByRole("link", { name: ATRIBUIDO.codigo }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Ensaio ${ATRIBUIDO.codigo}` })).toBeVisible();
    await expect(page.getByRole("table", { name: /Parcelas do ensaio/ }).getByRole("row")).toHaveCount(5); // cabeçalho + 4

    await page.goto("/ensaios/novo");
    await page.getByRole("button", { name: "Criar ensaio" }).click();
    await expect(page.getByRole("alert")).toContainText("Corrija os campos destacados.");
    await expect(page.getByText("Informe o código do ensaio")).toBeVisible();

    await page.getByLabel(/Código do ensaio/).fill("ENS-E2E-016");
    await page.getByLabel("Início previsto").fill("2027-02-10");
    await page.getByLabel("Fim previsto").fill("2027-02-01");
    await page.getByRole("button", { name: "Criar ensaio" }).click();
    await expect(page.getByText("A data final não pode ser anterior à inicial")).toBeVisible();

    await page.getByLabel("Fim previsto").fill("2027-03-01");
    await page.getByRole("button", { name: "Criar ensaio" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ensaio ENS-E2E-016" })).toBeVisible();
    await page.goto("/ensaios");
    await expect(page.getByRole("list", { name: "Lista de ensaios" })).toContainText("ENS-E2E-016");
  });

  for (const [email, nome] of [
    ["campo@exemplo.test", "field"],
    ["escritorio@exemplo.test", "home_office"],
  ] as const) {
    test(`${nome}: só o ensaio atribuído, sem criar, URL direta do outro negada`, async ({ page, request }) => {
      await entrar(page, email);
      await page.goto("/ensaios");
      const lista = page.getByRole("list", { name: "Lista de ensaios" });
      await expect(lista).toContainText(ATRIBUIDO.codigo);
      await expect(lista).not.toContainText(NAO_ATRIBUIDO.codigo);
      await expect(page.getByRole("link", { name: "Novo ensaio" })).toHaveCount(0);

      await page.getByRole("link", { name: ATRIBUIDO.codigo }).click();
      await expect(page.getByRole("heading", { level: 1, name: `Ensaio ${ATRIBUIDO.codigo}` })).toBeVisible();

      // IDOR: ensaio de outro responde "não encontrado" (a RLS esconde a linha).
      const direto = await page.goto(`/ensaios/${NAO_ATRIBUIDO.id}`);
      expect(direto?.status()).toBe(404);
      await expect(page.getByText(NAO_ATRIBUIDO.codigo)).toHaveCount(0);

      // Criar: a página é barrada no proxy e o POST direto da ação também.
      await page.goto("/ensaios/novo");
      await expect(page).toHaveURL(/\/inicio$/);
      const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const r = await request.post("/ensaios/novo", {
        maxRedirects: 0,
        headers: { cookie: cookies, "Next-Action": "0".repeat(40), origin: "http://localhost:3100" },
        multipart: { code: "ENS-INVASOR" },
      });
      expect(r.status()).toBe(307);
      expect(r.headers()["location"]).toContain("/inicio");
    });
  }

  test("mobile: lista legível sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await entrar(page, "campo@exemplo.test");
    await page.goto("/ensaios");
    await expect(page.getByRole("list", { name: "Lista de ensaios" })).toBeVisible();
    const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
    expect(larguras.doc).toBeLessThanOrEqual(larguras.janela);
  });
});
