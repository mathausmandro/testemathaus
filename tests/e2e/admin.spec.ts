// NÃO EXECUTADO: requer Docker/Supabase local (orientação de 27/10/2026).
// Tarefa 015: fluxo da coordenação (liberar, atribuir a ensaio, retirar, revogar) e tentativas dos outros perfis.
// Usa a pessoa sem perfil reservada a este teste (liberacao@exemplo.test, supabase/seed.sql), para não
// interferir em tests/e2e/perfis.spec.ts. Altera o banco: rode depois de `npx supabase db reset`.
// Rodar com: .env.local com AUTH_LOCAL_PASSWORD_LOGIN=true; npm run build;
//            E2E_SUPABASE=true npx playwright test tests/e2e/admin.spec.ts
// A lista de ensaios da pessoa vem da tarefa 016 (/ensaios); sem ela, os passos de visibilidade são pulados.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const SENHA_DO_SEED = "senha-teste-local"; // fictícia, só no banco local (supabase/seed.sql)
const PESSOA = { email: "liberacao@exemplo.test", nome: "Pessoa a Liberar", id: "10000000-0000-4000-8000-000000000006" };
const ENSAIO = { id: "20000000-0000-4000-8000-000000000002", codigo: "ENS-TESTE-02" };
const COORDENACAO_ID = "10000000-0000-4000-8000-000000000001";
const TEM_LISTA_DE_ENSAIOS = existsSync(join(process.cwd(), "src", "app", "(app)", "ensaios", "page.tsx"));

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA_DO_SEED);
  await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
}

async function novaSessao(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await entrar(page, email);
  return page;
}

async function ensaiosVisiveis(page: Page): Promise<string> {
  await page.goto("/ensaios");
  return (await page.locator("main").innerText()) ?? "";
}

test.describe("administração com Supabase local", () => {
  test.skip(process.env.E2E_SUPABASE !== "true", "requer Supabase local (defina E2E_SUPABASE=true)");
  test.describe.configure({ mode: "serial" });

  test("coordination libera a pessoa sem perfil e a mudança vale na próxima requisição", async ({ page, browser }) => {
    const pessoa = await novaSessao(browser, PESSOA.email);
    await expect(pessoa).toHaveURL(/\/aguardando$/);

    await entrar(page, "coordenacao@exemplo.test");
    await page.goto("/admin/usuarios?filtro=sem_perfil");
    const linha = page.getByRole("row", { name: new RegExp(PESSOA.nome) });
    await expect(linha.getByText("Sem perfil · aguardando liberação")).toBeVisible();
    await linha.getByRole("link", { name: `Liberar acesso de ${PESSOA.nome}` }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/usuarios/${PESSOA.id}$`));

    await page.getByLabel("Perfil de acesso").selectOption("field");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByRole("alert")).toContainText("Corrija os campos destacados.");
    await expect(page.getByText("Informe o motivo (mínimo de 3 caracteres)")).toBeVisible();

    await page.getByLabel("Motivo (obrigatório)").fill("Equipe de campo do piloto");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByRole("status")).toContainText("Perfil atualizado");
    await expect(page.getByRole("status")).toBeFocused();

    await page.reload();
    const historico = page.getByRole("table", { name: /Histórico de perfil desta pessoa/ });
    await expect(historico.getByRole("row", { name: /Equipe de campo do piloto/ })).toContainText("Sem perfil → Campo");
    await expect(historico).toContainText("Coordenação Fictícia");

    // Próxima requisição da pessoa: liberada.
    await pessoa.goto("/inicio");
    await expect(pessoa).toHaveURL(/\/inicio$/);
    await expect(pessoa.getByText("Seu perfil: Campo.")).toBeVisible();
    if (TEM_LISTA_DE_ENSAIOS) expect(await ensaiosVisiveis(pessoa)).not.toContain(ENSAIO.codigo);
  });

  test("coordination atribui a um ensaio e retira; o ensaio aparece e some para a pessoa", async ({ page, browser }) => {
    await entrar(page, "coordenacao@exemplo.test");
    await page.goto("/admin/ensaios");
    await page.getByRole("link", { name: ENSAIO.codigo }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Equipe do ensaio ${ENSAIO.codigo}` })).toBeVisible();

    await page.getByLabel("Pessoa", { exact: true }).selectOption({ label: `${PESSOA.nome} (Campo)` });
    await page.getByRole("button", { name: "Atribuir ao ensaio" }).click();
    await expect(page.getByRole("status")).toContainText("Pessoa atribuída ao ensaio.");

    const pessoa = await novaSessao(browser, PESSOA.email);
    if (TEM_LISTA_DE_ENSAIOS) expect(await ensaiosVisiveis(pessoa)).toContain(ENSAIO.codigo);

    await page.reload();
    await page.getByText(`Retirar ${PESSOA.nome} do ensaio`).click();
    await page.getByLabel("Motivo da retirada (obrigatório)").fill("Fim da etapa de campo");
    await page.getByRole("button", { name: "Retirar do ensaio" }).click();
    await expect(page.getByRole("alert")).toContainText("Corrija os campos destacados.");
    await page.getByLabel(/Confirmo a retirada/).check();
    await page.getByRole("button", { name: "Retirar do ensaio" }).click();
    await expect(page.getByRole("status")).toContainText("Pessoa retirada do ensaio.");

    await page.reload();
    const historico = page.getByRole("table", { name: /Histórico da equipe/ });
    await expect(historico.getByRole("row", { name: /Fim da etapa de campo/ })).toContainText("Retirada do ensaio");
    await expect(historico.getByRole("row", { name: /Atribuição ao ensaio pela coordenação/ })).toContainText("Atribuída ao ensaio");

    if (TEM_LISTA_DE_ENSAIOS) expect(await ensaiosVisiveis(pessoa)).not.toContain(ENSAIO.codigo);
  });

  test("coordination não altera o próprio perfil pela tela", async ({ page }) => {
    await entrar(page, "coordenacao@exemplo.test");
    await page.goto(`/admin/usuarios/${COORDENACAO_ID}`);
    await expect(page.getByText("Você não pode alterar o próprio perfil.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Perfil de acesso")).toHaveCount(0);
  });

  test("revogação pede confirmação e devolve a pessoa para Aguardando liberação", async ({ page, browser }) => {
    await entrar(page, "coordenacao@exemplo.test");
    await page.goto(`/admin/usuarios/${PESSOA.id}`);
    await page.getByLabel("Perfil de acesso").selectOption("sem_perfil");
    await page.getByLabel("Motivo (obrigatório)").fill("Saiu da equipe");
    await page.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(page.getByText("Confirme a revogação do acesso")).toBeVisible();
    await page.getByLabel(/Confirmo a revogação/).check();
    await page.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(page.getByRole("status")).toContainText("Acesso revogado.");

    const pessoa = await novaSessao(browser, PESSOA.email);
    await expect(pessoa).toHaveURL(/\/aguardando$/);
  });

  for (const [email, nome] of [
    ["campo@exemplo.test", "field"],
    ["escritorio@exemplo.test", "home_office"],
  ] as const) {
    test(`${nome}: páginas de administração e chamada direta de ação negadas`, async ({ page, request }) => {
      await entrar(page, email);
      await expect(page).toHaveURL(/\/inicio$/);
      for (const rota of ["/admin/usuarios", `/admin/usuarios/${PESSOA.id}`, "/admin/ensaios", `/admin/ensaios/${ENSAIO.id}`]) {
        await page.goto(rota);
        await expect(page, rota).toHaveURL(/\/inicio$/);
      }

      // POST de Server Action sem passar pela tela (id de ação qualquer): o proxy barra antes do servidor.
      // A action em si também nega (tests/unit/admin-actions.test.ts) e o banco nega (pgTAP 015).
      const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const r = await request.post("/admin/usuarios", {
        maxRedirects: 0,
        headers: { cookie: cookies, "Next-Action": "0".repeat(40), origin: "http://localhost:3100" },
        multipart: { userId: COORDENACAO_ID, perfil: "field", motivo: "Tentativa de escalada" },
      });
      expect(r.status()).toBe(307);
      expect(r.headers()["location"]).toContain("/inicio");
    });
  }
});
