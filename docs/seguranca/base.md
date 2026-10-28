# Base de segurança HTTP do app (tarefa 017)

Política de cabeçalhos, validação de entrada e suíte `npm run test:security`. Decisões e alternativas em [decisoes.md](decisoes.md).

## Cabeçalhos

| Cabeçalho | Valor | Onde |
| --- | --- | --- |
| Content-Security-Policy | ver abaixo (nonce novo a cada requisição) | `src/proxy.ts` + `src/lib/security/csp.ts` |
| X-Content-Type-Options | `nosniff` | `src/lib/security/headers.ts` (via `next.config.ts`) |
| Referrer-Policy | `strict-origin-when-cross-origin` | idem |
| Permissions-Policy | `camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()` | idem |
| X-Frame-Options | `DENY` (reserva; a CSP já tem `frame-ancestors 'none'`) | idem |
| Cross-Origin-Opener-Policy | `same-origin` | idem |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload`, só no build de produção | idem |

- HSTS: enviado por todo `next build`/`next start`. O navegador só o aplica quando recebe por HTTPS, então em `http://localhost` não tem efeito e no domínio da Vercel ele vale. Não é enviado em `next dev`, para não fixar HSTS em `https://localhost`. Antes de pedir a inclusão na lista de preload, confirme que todos os subdomínios do domínio da empresa usam HTTPS (tarefa 018).
- `poweredByHeader: false`. Nenhum cabeçalho CORS é liberado.

### Content-Security-Policy (produção)

```
default-src 'self';
script-src 'self' 'nonce-<aleatório>' 'strict-dynamic';
style-src 'self' 'nonce-<aleatório>';
img-src 'self' blob: data:;
font-src 'self';
connect-src 'self' <NEXT_PUBLIC_SUPABASE_URL> <mesma origem em ws/wss>;
worker-src 'self';
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self' <NEXT_PUBLIC_SUPABASE_URL>;
frame-ancestors 'none';
upgrade-insecure-requests   (só quando o site é servido por HTTPS)
```

- Em `next dev`, `script-src` ganha `'unsafe-eval'` (o React usa eval para depuração) e `style-src` usa `'unsafe-inline'` (o HMR injeta estilos). Nunca em produção (os testes reprovam).
- O nonce tem 128 bits (`crypto.getRandomValues`), vai no cabeçalho da requisição (`Content-Security-Policy` e `x-nonce`) e o Next o aplica sozinho aos scripts, estilos e preloads que renderiza. Para um `<Script>` próprio, leia `(await headers()).get("x-nonce")`.
- O nonce só chega aos scripts de páginas renderizadas na requisição. Por isso o layout raiz (`src/app/layout.tsx`) chama `await connection()` e exporta `instant = false`: nada é pré-renderizado como casca estática. Sem isso, a casca do Partial Prerendering sai sem nonce e o navegador bloqueia todos os scripts (conferido no build).
- `connect-src` usa a URL do Supabase de `NEXT_PUBLIC_SUPABASE_URL` (local, teste ou produção). Sem a variável, fica só `'self'`. URL inválida ou com outro esquema não entra. Nunca use curinga (`*`, `https:`).
- `form-action` inclui a origem do Supabase porque a Server Action do login Microsoft redireciona ao Supabase Auth. Sem JavaScript, o Chrome também aplica `form-action` nos redirecionamentos seguintes (Supabase → `login.microsoftonline.com`). Se o login sem JavaScript for necessário, acrescente `https://login.microsoftonline.com` (ver Dúvidas na tarefa 017). Com JavaScript (o normal), o redirecionamento é uma navegação e não passa por `form-action`.

### Como ajustar a CSP ao adicionar um domínio

1. Edite só `src/lib/security/csp.ts` (função `montarCsp`), na diretiva certa:
   - **Storage do Supabase** (fotos com link assinado, Fase 3): já coberto em `connect-src` (mesma origem do projeto). Para exibir em `<img>`, acrescente `origensDoSupabase(...)[0]` em `img-src`. Se usar `next/image` com otimização, a imagem vem de `'self'` e nada muda.
   - **Realtime** (Fase 5): já coberto (`wss://` da mesma origem).
   - **Microsoft Graph** chamado do navegador: `connect-src https://graph.microsoft.com`. O preferível é chamar do servidor ou de Edge Function, e aí nada muda.
   - **Serwist (service worker, Fase 3)**: o `sw.js` vem de `'self'` (`worker-src 'self'`). O manifesto já tem `manifest-src 'self'`. Pré-cache de páginas HTML é incompatível com nonce, porque a página em cache traz um nonce velho e a CSP nova o recusa. Faça pré-cache só de recursos estáticos e de telas de coleta renderizadas no cliente (ver decisoes.md).
   - **Fonte ou script de terceiros**: evite. Se for indispensável, use o domínio exato, nunca curinga. Com `'strict-dynamic'`, um script de terceiro precisa do nonce (`<Script nonce=...>`).
2. Acrescente o caso em `tests/unit/csp.test.ts`.
3. Rode `npm run build`, `npx playwright test tests/e2e/seguranca.spec.ts` (sem violação de CSP no console) e `npm run test:perf` (Boas práticas ≥ 0,9).
4. Os domínios definitivos de produção (Vercel e projeto Supabase) entram na tarefa 018, pelas variáveis de ambiente. Não há domínio fixo no código.

## Validação de entrada (`src/lib/validation`)

Padrão único para Server Actions e Route Handlers:

1. Guarda de sessão e perfil (`exigirPerfil`/`exigirSessao`) **antes** de ler a entrada.
2. `lerFormulario(form, campos)` ou `lerParametros(searchParams, campos)`: lê só os campos listados. Arquivos e campos acima de 10.000 caracteres viram ausentes.
3. `validarEntrada(schema, dados)` ou `validarFormulario(...)`: zod. Erro vira `DataError("invalid")` com mensagens por campo em pt-BR.
4. `falhaDe(e)` monta o `EstadoDaAcao`: mensagem fixa em pt-BR ("Corrija os campos destacados." ou a mensagem genérica do código do erro), sem stack, sem mensagem do banco e sem detalhes do zod.

`tests/security/validacao-entrada.test.ts` varre `src/app` e reprova quando: uma função exportada de `actions.ts`/`route.ts` recebe argumento sem passar por `validarEntrada`/`validarFormulario`; há `form.get(`/`searchParams.get(` solto; um `"use server"` aparece fora de `actions.ts`; uma resposta devolve `e.message`/`e.stack`/`e.cause`.

## Suíte `npm run test:security`

`scripts/test-security.mjs`, que também roda dentro do `npm run verify` (etapa Segurança, depois do build) e, portanto, no CI:

| Etapa | O que reprova |
| --- | --- |
| secretlint `**/*` | segredo em qualquer arquivo da árvore (inclui `.env.example` e o lockfile) |
| npm audit `--audit-level=high` | dependência com vulnerabilidade alta ou crítica |
| gitleaks `git` | segredo em qualquer commit. Localmente, sem o binário, aparece como IGNORADA; no CI é obrigatório (o workflow põe o binário com checksum no PATH) |
| build | só roda se `.next/BUILD_ID` faltar |
| `vitest run tests/security` | ver abaixo |

| Arquivo | Cobre |
| --- | --- |
| `cabecalhos.test.ts` | todas as rotas de `src/app` × (anônimo, sem perfil, cada perfil, erro): todos os cabeçalhos, valores da CSP e HSTS, CSP em todo caminho de saída do proxy |
| `acesso-por-perfil.test.ts` | matriz rota × perfil: rota que não pertence ao perfil é negada no proxy e na página; Server Actions exigem os perfis revisados |
| `rotas-protegidas.test.ts` (014) | toda página de `(app)` e todo handler exigem sessão; lista de rotas públicas fixa |
| `validacao-entrada.test.ts` | validação centralizada (acima) |
| `segredos.test.ts` | segredos nos arquivos versionados; `.env*` ignorado; varredura do bundle do cliente (`.next/static`), obrigatória no test:security |
| `secret-key-isolation.test.ts` (G3) | `SUPABASE_SECRET_KEY` só em `src/lib/data/server` e `env.server.ts`; nada em `"use client"` nem em `NEXT_PUBLIC_*` |
| `use-cache.test.ts` (S6) | nenhum `"use cache"`/`"use cache: remote"` em arquivo que importa `src/lib/data` |
| `artefatos-e2e.test.ts` (G2) | sem trace/vídeo/captura no CI, storageState em `playwright/.auth` (ignorado e fora das pastas enviadas), limpeza antes do upload |
| `admin-acoes.test.ts`, `env-example.test.ts` | tarefas 015 e 002 |

O e2e `tests/e2e/seguranca.spec.ts` confere os cabeçalhos na resposta HTTP real, o nonce em todos os `<script>` e a ausência de violação de CSP (evento `securitypolicyviolation` e console) nas telas públicas. As telas logadas exigem o Supabase local (`E2E_SUPABASE=true`).
