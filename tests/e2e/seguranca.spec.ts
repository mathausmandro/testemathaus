// Tarefa 017: cabeçalhos de segurança na resposta HTTP real e telas sem violação de CSP.
// A parte sem banco roda em qualquer máquina. A parte logada exige Supabase local
// (NÃO EXECUTADO aqui: requer Docker/Supabase local; rode com E2E_SUPABASE=true após `npx supabase db reset`).
import { expect, test, type Page } from "@playwright/test";

const OBRIGATORIOS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
  "strict-transport-security",
];

/** Registra violações de CSP (evento do navegador) e erros de CSP no console. */
async function vigiarCsp(page: Page): Promise<string[]> {
  const violacoes: string[] = [];
  await page.exposeFunction("__registrarViolacaoCsp", (v: string) => violacoes.push(v));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __registrarViolacaoCsp: (v: string) => void }).__registrarViolacaoCsp(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  page.on("console", (msg) => {
    if (/Content Security Policy|Content-Security-Policy/i.test(msg.text())) violacoes.push(`console: ${msg.text()}`);
  });
  return violacoes;
}

test.describe("cabeçalhos de segurança", () => {
  for (const rota of ["/", "/login"]) {
    test(`${rota}: todos os cabeçalhos e nonce nos scripts`, async ({ request }) => {
      const r = await request.get(rota);
      expect(r.status()).toBe(200);
      const h = r.headers();
      for (const nome of OBRIGATORIOS) expect(h[nome], nome).toBeTruthy();
      const csp = h["content-security-policy"];
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toMatch(/unsafe-eval|unsafe-inline/);
      const nonce = /'nonce-([^']+)'/.exec(csp)![1];
      const html = await r.text();
      const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
      expect(scripts.length).toBeGreaterThan(0);
      for (const s of scripts) expect(s, s).toContain(`nonce="${nonce}"`);
    });
  }

  test("nonce muda a cada requisição", async ({ request }) => {
    const a = (await request.get("/")).headers()["content-security-policy"];
    const b = (await request.get("/")).headers()["content-security-policy"];
    expect(a).not.toBe(b);
  });

  test("rota logada sem sessão: o redirecionamento também leva os cabeçalhos", async ({ request }) => {
    const r = await request.get("/inicio", { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    for (const nome of OBRIGATORIOS) expect(r.headers()[nome], nome).toBeTruthy();
  });
});

test.describe("telas sem violação de CSP", () => {
  test("página inicial e login (inclusive navegação no cliente)", async ({ page }) => {
    const violacoes = await vigiarCsp(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Plataforma de Ensaios" })).toBeVisible();
    await page.getByRole("link", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
    await page.goto("/login?erro=credenciais");
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(violacoes).toEqual([]);
  });

  test("a página não pode ser embutida em iframe", async ({ page, baseURL }) => {
    const violacoes = await vigiarCsp(page);
    await page.setContent(`<iframe id="f" src="${baseURL}/"></iframe>`);
    const frame = page.frame({ url: /localhost/ });
    // Bloqueado por frame-ancestors: o iframe fica sem o conteúdo do app.
    await page.waitForTimeout(500);
    expect(await frame?.locator("h1").count().catch(() => 0) ?? 0).toBe(0);
    // O navegador relata no console o bloqueio por frame-ancestors (é o comportamento esperado).
    await expect.poll(() => violacoes.some((v) => /frame-ancestors|X-Frame-Options/i.test(v))).toBe(true);
  });
});

test.describe("telas logadas sem violação de CSP (Supabase local)", () => {
  test.skip(process.env.E2E_SUPABASE !== "true", "requer Supabase local (defina E2E_SUPABASE=true)");

  test("coordination: início, ensaios, novo ensaio e administração", async ({ page }) => {
    const violacoes = await vigiarCsp(page);
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("coordenacao@exemplo.test");
    await page.getByLabel("Senha").fill("senha-teste-local"); // fictícia, só no banco local (supabase/seed.sql)
    await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    for (const rota of ["/inicio", "/ensaios", "/ensaios/novo", "/admin", "/admin/usuarios", "/admin/ensaios"]) {
      const r = await page.goto(rota);
      for (const nome of OBRIGATORIOS) expect(r?.headers()[nome], `${rota} ${nome}`).toBeTruthy();
      await page.waitForLoadState("networkidle");
    }
    expect(violacoes).toEqual([]);
  });
});
