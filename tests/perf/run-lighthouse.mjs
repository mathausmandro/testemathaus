// Faz build, sobe o servidor, roda Lighthouse CI sobre as páginas públicas de lighthouserc.json (inicial e login) e encerra o servidor.
// Relatórios ficam em .lighthouseci (upload target filesystem; nada sai da máquina).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const PORT = 3200;
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const npx = isWin ? "npx.cmd" : "npx";
const skipBuild = process.argv.includes("--skip-build");
// /cli fica isolado em tools/lhci (package-lock próprio, npm ci --ignore-scripts).
const LHCI_DIR = path.resolve("tools", "lhci");
const LHCI_CLI = path.join(LHCI_DIR, "node_modules", "@lhci", "cli", "src", "cli.js");
const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { stdio: "inherit", shell: isWin, ...opts });

// Procura o chrome-headless-shell instalado pelo Playwright (mais leve e sem dependência de
// manifesto lado a lado do Windows); se não achar, usa o executável do Chromium do Playwright.
function findHeadlessShell() {
  const home = os.homedir();
  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "ms-playwright")
      : process.platform === "darwin"
        ? path.join(home, "Library", "Caches", "ms-playwright")
        : path.join(home, ".cache", "ms-playwright"));
  const exe = process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell";
  if (!fs.existsSync(root)) return null;
  for (const dir of fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell"))) {
    const base = path.join(root, dir);
    for (const sub of fs.readdirSync(base)) {
      const candidate = path.join(base, sub, exe);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

if (!process.env.CHROME_PATH) {
  try {
    const require = createRequire(import.meta.url);
    const { chromium } = require("@playwright/test");
    process.env.CHROME_PATH = findHeadlessShell() || chromium.executablePath();
  } catch {
    console.error("Defina CHROME_PATH ou rode: npx playwright install chromium");
    process.exit(1);
  }
}

if (!fs.existsSync(LHCI_CLI)) {
  const inst = run(npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", LHCI_DIR]);
  if (inst.status !== 0) process.exit(inst.status ?? 1);
}

if (!skipBuild) {
  const build = run(npm, ["run", "build"]);
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn(npx, ["next", "start", "-p", String(PORT)], { stdio: "inherit", shell: isWin });
const stop = () => {
  if (isWin) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let code = 1;
try {
  if (await waitReady()) {
    const lh = run(process.execPath, [LHCI_CLI, "autorun", "--config=lighthouserc.json"], { shell: false });
    code = lh.status ?? 1;
  } else {
    console.error("Servidor não respondeu a tempo.");
  }
} finally {
  stop();
}
process.exit(code);