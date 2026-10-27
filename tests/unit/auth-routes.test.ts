import { describe, expect, it } from "vitest";
import { avaliarAcesso } from "@/lib/auth/guard";
import { decidirRota, ehRotaPublica, perfisDaArea, type EstadoDaSessao } from "@/lib/auth/routes";

const ANON: EstadoDaSessao = { tipo: "anonimo" };
const SEM: EstadoDaSessao = { tipo: "sem_perfil" };
const ERRO: EstadoDaSessao = { tipo: "erro" };
const COORD: EstadoDaSessao = { tipo: "com_perfil", perfil: "coordination" };
const CAMPO: EstadoDaSessao = { tipo: "com_perfil", perfil: "field" };
const HOME: EstadoDaSessao = { tipo: "com_perfil", perfil: "home_office" };

const seguir = { tipo: "seguir" };
const ir = (destino: string) => ({ tipo: "redirecionar", destino });

describe("decidirRota: rotas públicas", () => {
  it.each([ANON, SEM, COORD, ERRO])("página inicial e callback sempre seguem (%j)", (estado) => {
    expect(decidirRota("/", "", estado)).toEqual(seguir);
    expect(decidirRota("/auth/callback", "?code=x", estado)).toEqual(seguir);
  });

  it("login: anônimo vê; sem perfil vai aguardar; com perfil vai ao início", () => {
    expect(decidirRota("/login", "", ANON)).toEqual(seguir);
    expect(decidirRota("/login", "", ERRO)).toEqual(seguir);
    expect(decidirRota("/login", "", SEM)).toEqual(ir("/aguardando"));
    expect(decidirRota("/login", "", COORD)).toEqual(ir("/inicio"));
  });

  it("só /, /login e /auth/callback são públicas", () => {
    expect(ehRotaPublica("/")).toBe(true);
    expect(ehRotaPublica("/login/")).toBe(true);
    expect(ehRotaPublica("/auth/callback")).toBe(true);
    for (const p of ["/inicio", "/admin", "/aguardando", "/auth", "/auth/outra", "/Login", "/login/extra", "/api/x"]) {
      expect(ehRotaPublica(p), p).toBe(false);
    }
  });
});

describe("decidirRota: sem sessão", () => {
  it("rotas logadas vão para o login levando o next", () => {
    expect(decidirRota("/inicio", "", ANON)).toEqual(ir("/login?next=%2Finicio"));
    expect(decidirRota("/ensaios/1", "?aba=croqui", ANON)).toEqual(ir("/login?next=%2Fensaios%2F1%3Faba%3Dcroqui"));
  });

  it("rota desconhecida também é protegida (nega por padrão), sem next fora da lista", () => {
    expect(decidirRota("/qualquer", "", ANON)).toEqual(ir("/login"));
    expect(decidirRota("/aguardando", "", ANON)).toEqual(ir("/login"));
  });

  it("falha ao consultar o perfil não libera: vai ao login com aviso", () => {
    expect(decidirRota("/inicio", "", ERRO)).toEqual(ir("/login?erro=indisponivel"));
  });
});

describe("decidirRota: sem perfil", () => {
  it.each(["/inicio", "/admin", "/ensaios/1", "/qualquer"])("%s vai para aguardando", (p) => {
    expect(decidirRota(p, "", SEM)).toEqual(ir("/aguardando"));
  });

  it("aguardando segue (sem loop)", () => {
    expect(decidirRota("/aguardando", "", SEM)).toEqual(seguir);
  });
});

describe("decidirRota: com perfil", () => {
  it.each([COORD, CAMPO, HOME])("início segue e aguardando volta ao início (%j)", (estado) => {
    expect(decidirRota("/inicio", "", estado)).toEqual(seguir);
    expect(decidirRota("/aguardando", "", estado)).toEqual(ir("/inicio"));
  });

  it("administração só para coordination", () => {
    expect(decidirRota("/admin", "", COORD)).toEqual(seguir);
    expect(decidirRota("/admin/perfis", "", COORD)).toEqual(seguir);
    expect(decidirRota("/admin", "", CAMPO)).toEqual(ir("/inicio"));
    expect(decidirRota("/admin/perfis/", "", HOME)).toEqual(ir("/inicio"));
    expect(decidirRota("/administracao-falsa", "", CAMPO)).toEqual(seguir);
    expect(perfisDaArea("/admin")).toEqual(["coordination"]);
  });

  it("nenhuma decisão redireciona para fora do site", () => {
    const estados = [ANON, SEM, COORD, CAMPO, HOME, ERRO];
    const caminhos = ["/", "/login", "/inicio", "/admin", "/aguardando", "/x", "//outro-site.example"];
    for (const e of estados)
      for (const c of caminhos) {
        const d = decidirRota(c, "?next=https://outro-site.example", e);
        if (d.tipo === "redirecionar") {
          expect(d.destino.startsWith("/")).toBe(true);
          expect(d.destino.startsWith("//")).toBe(false);
        }
      }
  });

  it("nunca redireciona para a própria rota (sem loop)", () => {
    const estados = [ANON, SEM, COORD, CAMPO, HOME, ERRO];
    for (const e of estados)
      for (const c of ["/login", "/inicio", "/admin", "/aguardando"]) {
        const d = decidirRota(c, "", e);
        if (d.tipo === "redirecionar") expect(d.destino.split("?")[0]).not.toBe(c);
      }
  });
});

describe("avaliarAcesso (helper de servidor)", () => {
  it("sem sessão, sem perfil, sem permissão e ok", () => {
    expect(avaliarAcesso(null)).toBe("sem_sessao");
    expect(avaliarAcesso({ perfil: null })).toBe("sem_perfil");
    expect(avaliarAcesso({ perfil: { role: null } })).toBe("sem_perfil");
    expect(avaliarAcesso({ perfil: { role: "field" } })).toBe("ok");
    expect(avaliarAcesso({ perfil: { role: "field" } }, ["coordination"])).toBe("sem_permissao");
    expect(avaliarAcesso({ perfil: { role: "coordination" } }, ["coordination"])).toBe("ok");
    expect(avaliarAcesso({ perfil: { role: "coordination" } }, [])).toBe("sem_permissao");
  });
});
