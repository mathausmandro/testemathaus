import { describe, expect, it } from "vitest";
import { buildEnvLocal, mapStatus, parseStatusEnv } from "../../scripts/setup-local.mjs";

const novo = `API_URL="http://127.0.0.1:54321"\nPUBLISHABLE_KEY="pub-teste"\nSECRET_KEY="sec-teste"\nDB_URL="postgresql://x"\n`;
const antigo = `API_URL="http://127.0.0.1:54321"\nANON_KEY="anon-teste"\nSERVICE_ROLE_KEY="svc-teste"\n`;

describe("setup-local", () => {
  it("lê o formato do supabase status -o env", () => {
    expect(parseStatusEnv(novo).API_URL).toBe("http://127.0.0.1:54321");
  });

  it("mapeia nomes novos e antigos das chaves", () => {
    expect(mapStatus(parseStatusEnv(novo)).publicVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("pub-teste");
    const m = mapStatus(parseStatusEnv(antigo));
    expect(m.publicVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon-teste");
    expect(m.serverVars.SUPABASE_SECRET_KEY).toBe("svc-teste");
  });

  it("falha com mensagem clara se faltar URL ou chave", () => {
    expect(() => mapStatus({})).toThrow(/Supabase local está rodando/);
  });

  it("o modo CI exporta só variáveis públicas", () => {
    const { publicVars } = mapStatus(parseStatusEnv(novo));
    expect(Object.keys(publicVars).every((k) => k.startsWith("NEXT_PUBLIC_"))).toBe(true);
    expect(JSON.stringify(publicVars)).not.toContain("sec-teste");
  });

  it("o .env.local gerado deixa o domínio em branco", () => {
    const txt = buildEnvLocal(mapStatus(parseStatusEnv(novo)));
    expect(txt).toMatch(/^ALLOWED_EMAIL_DOMAIN=$/m);
    expect(txt).toMatch(/^SUPABASE_SECRET_KEY=sec-teste$/m);
  });
});
