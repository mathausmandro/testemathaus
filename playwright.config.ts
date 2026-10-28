import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const ci = Boolean(process.env.CI);

/**
 * G2 (docs/seguranca/002.md): sessão nunca vai para artefato publicado.
 * - storageState de e2e autenticado, quando existir, fica em STORAGE_STATE_DIR (fora de
 *   test-results/ e playwright-report/, que o CI envia) e está no .gitignore.
 * - No CI não há trace (ele guarda cookies e cabeçalhos); localmente só na nova tentativa.
 * - O workflow ainda apaga *.zip, *.har e storageState das pastas antes do upload.
 * tests/security/artefatos-e2e.test.ts confere estas regras.
 */
export const STORAGE_STATE_DIR = "playwright/.auth";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: ci ? "off" : "on-first-retry",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
