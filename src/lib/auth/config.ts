// Configuração do login, lida de variáveis de ambiente do SERVIDOR (nenhuma é NEXT_PUBLIC).
// Nada de tenant, client id, segredo ou domínio aqui: esses valores ficam no Supabase Auth
// (supabase/config.toml lendo env(...) localmente; painel do projeto em teste e produção).

export type FonteDeAmbiente = Record<string, string | undefined>;

export type ConfigDeLogin = {
  /** Mostra o botão "Entrar com a conta Microsoft" habilitado. */
  microsoftHabilitado: boolean;
  /** Formulário de e-mail e senha para os usuários de teste do seed (só ambiente local). */
  loginLocalPorSenha: boolean;
  /** URL pública do site (opcional); sem ela, usa a origem da requisição. */
  urlDoSite: string | null;
};

const ligado = (v: string | undefined) => (v ?? "").trim().toLowerCase() === "true";

/** Hosts que só existem na máquina do desenvolvedor (Supabase local ou container apontando para o host). */
const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "host.docker.internal"]);

export function ehUrlLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return HOSTS_LOCAIS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * O login por senha só vale com TODAS as condições:
 * 1. AUTH_LOCAL_PASSWORD_LOGIN=true;
 * 2. o Supabase apontado é local (localhost, 127.0.0.1 ou host.docker.internal);
 * 3. não é implantação da Vercel em preview ou produção (VERCEL_ENV) nem APP_ENV=production.
 * Assim, mesmo que a variável vaze para a produção, o Supabase de produção não é local e o modo fica desligado.
 */
export function loginLocalPermitido(env: FonteDeAmbiente): boolean {
  if (!ligado(env.AUTH_LOCAL_PASSWORD_LOGIN)) return false;
  if (!ehUrlLocal(env.NEXT_PUBLIC_SUPABASE_URL)) return false;
  const vercel = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercel === "production" || vercel === "preview") return false;
  if ((env.APP_ENV ?? "").trim().toLowerCase() === "production") return false;
  return true;
}

function urlDoSite(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function lerConfigDeLogin(env: FonteDeAmbiente): ConfigDeLogin {
  return {
    microsoftHabilitado: ligado(env.AUTH_MICROSOFT_ENABLED),
    loginLocalPorSenha: loginLocalPermitido(env),
    urlDoSite: urlDoSite(env.SITE_URL),
  };
}

/** Leitura em tempo de execução (chame só no servidor e dentro de requisição). */
export function getConfigDeLogin(): ConfigDeLogin {
  return lerConfigDeLogin({
    AUTH_MICROSOFT_ENABLED: process.env.AUTH_MICROSOFT_ENABLED,
    AUTH_LOCAL_PASSWORD_LOGIN: process.env.AUTH_LOCAL_PASSWORD_LOGIN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    APP_ENV: process.env.APP_ENV,
    SITE_URL: process.env.SITE_URL,
  });
}

/** Origem do site: SITE_URL, se definida; senão a origem da requisição. */
export function origemDoSite(config: ConfigDeLogin, origemDaRequisicao: string): string {
  return config.urlDoSite ?? new URL(origemDaRequisicao).origin;
}

/**
 * Origem da requisição a partir dos cabeçalhos (Server Actions não recebem a URL).
 * Host malformado cai em localhost. Mesmo com Host forjado não há open redirect: o Supabase Auth
 * só aceita redirect_to da sua lista de endereços permitidos (additional_redirect_urls).
 */
export function origemDosCabecalhos(get: (nome: string) => string | null): string {
  const host = (get("x-forwarded-host") ?? get("host") ?? "").split(",")[0].trim();
  const proto = (get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  const hostValido = /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) || /^\[[0-9a-f:]+\](:\d{1,5})?$/i.test(host);
  const esquema = proto === "https" ? "https" : "http";
  return `${esquema}://${hostValido ? host : "localhost"}`;
}

/** Mensagens de erro da tela de login: só códigos fixos, nunca texto vindo da URL. */
export const MENSAGENS_DE_LOGIN = {
  credenciais: "E-mail ou senha inválidos.",
  provedor: "Não foi possível entrar com esta conta Microsoft. Use a conta da empresa ou procure a coordenação.",
  callback: "Não foi possível concluir a entrada. Tente novamente.",
  indisponivel: "Login indisponível no momento. Tente novamente em instantes.",
  sessao: "Sua sessão expirou. Entre novamente.",
} as const;

export type CodigoDeErroDeLogin = keyof typeof MENSAGENS_DE_LOGIN;

export function mensagemDeLogin(codigo: string | string[] | undefined): string | null {
  const c = Array.isArray(codigo) ? codigo[0] : codigo;
  if (!c || !Object.hasOwn(MENSAGENS_DE_LOGIN, c)) return null;
  return MENSAGENS_DE_LOGIN[c as CodigoDeErroDeLogin];
}
