// Verificação estática do Docker (tarefa 003). A inspeção da imagem real exige Docker:
// não executado aqui (requer Docker); ver docs/ambiente.md e docs/qa/validacao-docker.md.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const semComentarios = (texto: string) =>
  texto
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
const dockerfile = semComentarios(readFileSync("Dockerfile", "utf8"));
const dockerignore = readFileSync(".dockerignore", "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const composeRaw = semComentarios(readFileSync("docker-compose.yml", "utf8"));
const compose = parse(composeRaw);
const nextConfig = readFileSync("next.config.ts", "utf8");

const stage = (name: string) => {
  const parts = dockerfile.split(/^FROM /m).slice(1);
  const found = parts.find((p) => new RegExp(`\\bAS ${name}\\b`).test(p.split("\n")[0]));
  if (!found) throw new Error(`etapa ${name} ausente`);
  return found;
};

describe("Dockerfile", () => {
  it("tem as etapas deps, dev, build e runner", () => {
    for (const n of ["deps", "dev", "build", "runner"]) expect(() => stage(n)).not.toThrow();
  });

  it("a imagem final e a de desenvolvimento rodam sem root", () => {
    expect(stage("runner")).toMatch(/^USER node$/m);
    expect(stage("dev")).toMatch(/^USER node$/m);
    expect(dockerfile).not.toMatch(/^USER\s+(root|0)\b/m);
  });

  it("não declara segredos como ARG ou ENV", () => {
    expect(dockerfile).not.toMatch(/SUPABASE_SECRET_KEY/);
    expect(dockerfile).not.toMatch(/ALLOWED_EMAIL_DOMAIN/);
    const decl = dockerfile.match(/^\s*(ARG|ENV)\s+.*$/gm) ?? [];
    expect(decl.join("\n")).not.toMatch(/SECRET|SERVICE_ROLE|PASSWORD|TOKEN/i);
  });

  it("só aceita variáveis NEXT_PUBLIC_ como ARG de build", () => {
    const args = [...dockerfile.matchAll(/^ARG\s+([A-Z0-9_]+)/gm)].map((m) => m[1]);
    for (const a of args) {
      expect(["NODE_VERSION", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]).toContain(a);
    }
  });

  it("não copia arquivos .env para a imagem", () => {
    expect(dockerfile).not.toMatch(/COPY[^\n]*\.env/);
  });

  it("a imagem final copia só o standalone, estáticos e public", () => {
    const r = stage("runner");
    expect(r).toContain("/app/.next/standalone");
    expect(r).toContain("/app/.next/static");
    expect(r).toMatch(/CMD \["node", "server\.js"\]/);
    expect(r).not.toMatch(/COPY \. /);
  });
});

describe(".dockerignore", () => {
  it("exclui .env*, node_modules, .next, supabase/.temp e .git", () => {
    for (const p of [".env*", "node_modules", ".next", "supabase/.temp", ".git"]) expect(dockerignore).toContain(p);
  });

  it("só reabre o .env.example", () => {
    expect(dockerignore.filter((l) => l.startsWith("!"))).toEqual(["!.env.example"]);
  });
});

describe("docker-compose", () => {
  it("tem perfis dev e prod", () => {
    expect(compose.services["app-dev"].profiles).toEqual(["dev"]);
    expect(compose.services["app-prod"].profiles).toEqual(["prod"]);
  });

  it("lê variáveis de .env.local por env_file", () => {
    for (const s of ["app-dev", "app-prod"]) expect(compose.services[s].env_file).toContain(".env.local");
  });

  it("não passa SUPABASE_SECRET_KEY como build arg", () => {
    expect(composeRaw).not.toMatch(/SUPABASE_SECRET_KEY/);
    for (const a of Object.keys(compose.services["app-prod"].build.args)) expect(a).toMatch(/^NEXT_PUBLIC_/);
  });

  it("o perfil prod usa a imagem final e endurece o container", () => {
    const p = compose.services["app-prod"];
    expect(p.build.target).toBe("runner");
    expect(p.read_only).toBe(true);
    expect(p.cap_drop).toContain("ALL");
    expect(compose.services["app-dev"].build.target).toBe("dev");
  });
});

describe("next.config", () => {
  it("usa output standalone", () => {
    expect(nextConfig).toMatch(/output:\s*"standalone"/);
  });
});
