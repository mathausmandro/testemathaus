import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lines = readFileSync(".env.example", "utf8").split(/\r?\n/);
const assignments = lines.filter((l) => /^[A-Z0-9_]+=/.test(l));
const names = assignments.map((l) => l.split("=")[0]);

describe(".env.example", () => {
  it("tem só nomes, sem valores", () => {
    for (const l of assignments) expect(l.split("=")[1], l).toBe("");
  });

  it("não expõe segredo em variável NEXT_PUBLIC", () => {
    const pub = names.filter((n) => n.startsWith("NEXT_PUBLIC_"));
    expect(pub.length).toBeGreaterThan(0);
    for (const n of pub) expect(n).not.toMatch(/SECRET|SERVICE|PRIVATE/);
  });

  it("mantém SUPABASE_SECRET_KEY e ALLOWED_EMAIL_DOMAIN sem prefixo público", () => {
    expect(names).toContain("SUPABASE_SECRET_KEY");
    expect(names).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET_KEY");
    expect(names).not.toContain("NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN");
  });
});
