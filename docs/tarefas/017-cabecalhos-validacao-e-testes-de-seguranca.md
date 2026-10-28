# 017 - Cabeçalhos de segurança, validação de entrada e suíte test:security
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

## Objetivo
Aplicar a configuração de segurança HTTP do app e montar a suíte tests/security executada por npm run test:security, cobrindo cabeçalhos, segredos, rotas protegidas e dependências.

## Escopo
Inclui:
- Cabeçalhos em next.config: Content-Security-Policy (compatível com Next.js, Supabase local e de teste e produção, sem unsafe-inline desnecessário), X-Content-Type-Options, Referrer-Policy, Permissions-Policy (câmera e localização apenas no próprio site), HSTS (efetivo fora do local), frame-ancestors/X-Frame-Options.
- Utilitário compartilhado de validação zod para Server Actions (padrão de erro uniforme, sem vazar detalhes internos).
- Suíte tests/security: verifica cabeçalhos em páginas públicas e logadas; varre o bundle do cliente e o repositório em busca de SUPABASE_SECRET_KEY e outros segredos; confirma que todas as rotas de src/app/(app) e src/app/api exigem sessão; confirma .env* no .gitignore; roda npm audit e gitleaks.
- Documento docs/seguranca/base.md com a política de cabeçalhos e como ajustar o CSP ao adicionar domínios (ex.: Storage).

Não inclui: rate limiting avançado, WAF, revisão formal (papel seguranca), cabeçalhos específicos de upload de fotos (Fase 3).

## Arquivos afetados
next.config.ts, src/lib/validation/*, tests/security/*, package.json, docs/seguranca/base.md, pipeline (002).

## Critérios de aceite
- [ ] Resposta de páginas públicas e logadas inclui todos os cabeçalhos definidos (teste automatizado).
- [ ] O app (login, lista de ensaios) funciona normalmente com o CSP ativo, sem erros de CSP no console (e2e).
- [ ] npm run test:security passa no estado atual e falha quando: um cabeçalho é removido, um segredo falso é adicionado, uma rota logada sai da proteção ou existe dependência alta/crítica (cada caso verificado e revertido).
- [ ] test:security roda no npm run verify e no CI.
- [ ] Entradas inválidas em Server Actions retornam erro padronizado em português, sem stack trace.
- [ ] Acesso por perfil: o teste de rotas confirma resposta negada para cada perfil em rotas que não lhe pertencem.

## Testes esperados
Unitários: utilitário de validação. e2e: sem erros de CSP nas telas existentes. pgTAP: não se aplica. Performance: impacto dos cabeçalhos nulo; Lighthouse boas práticas. Segurança: toda a tarefa.

## Riscos e dependências
- Depende de 001, 002 e, para varrer rotas reais, de 014. Pode começar cedo e ser completada após 016.
- Risco: CSP muito estrito quebra Next.js/Serwist em fases futuras; documentar como evoluir.

## Herdado da tarefa 001
- Segurança S2: CSP, HSTS e frame-ancestors faltam no next.config.ts (docs/seguranca/001.md).
- Segurança S6: dados de ensaio nunca em `use cache` compartilhado (cacheComponents ligado); acrescentar regra à skill nextjs-app-router.

## Herdado da tarefa 002
- G2: quando houver e2e autenticado, os artefatos do Playwright (traces, vídeos, screenshots, storage state) podem conter sessão/tokens; não publicá-los no CI sem sanitizar ou restringir (docs/seguranca/002.md).
- G3: teste de segurança que falhe se `SUPABASE_SECRET_KEY` aparecer em arquivo com a diretiva `"use client"` (e em qualquer `NEXT_PUBLIC_*`).

## Dúvidas para o Mathaus
- Nenhuma de regra agronômica. Os domínios definitivos (Vercel e Supabase) serão necessários na tarefa 018 para fechar o CSP de produção (entram por variável de ambiente; nada fixo no código).
- Registro técnico (para o papel seguranca/TI, não bloqueia): o login Microsoft **sem JavaScript** pode exigir `https://login.microsoftonline.com` em `form-action` (o Chrome aplica `form-action` aos redirecionamentos de um POST nativo). Com JavaScript, o caso normal, não faz diferença. Validar quando o Entra ID estiver registrado (tarefa 012).

## Entrega (preenchido pelo desenvolvedor)

**Não executado: requer Docker/Supabase local**: o e2e logado sem violação de CSP (`tests/e2e/seguranca.spec.ts`, bloco `E2E_SUPABASE=true`) e o gitleaks local (binário não instalado aqui; ele roda no CI). Executado aqui: lint, typecheck, `npm test` (488 testes), `npm run test:security` (101 testes de segurança, varredura do bundle incluída) e `npm run verify` completo, que passou em 236 s com pgTAP ignorada. Lighthouse: Boas práticas 1,0 e desempenho de 0,98 a 1,0 em `/` e `/login`, já com a CSP nova.

### O que foi feito
- **CSP com nonce por requisição (S2)**: `src/lib/security/csp.ts` (funções puras) e `src/proxy.ts`. O nonce tem 128 bits e vai no cabeçalho da requisição (o Next o aplica a scripts, estilos e preloads) e na resposta. `script-src 'self' 'nonce-…' 'strict-dynamic'`, sem `unsafe-eval`/`unsafe-inline` em produção (só em `next dev`). `connect-src` só com `'self'` e a URL do Supabase (`NEXT_PUBLIC_SUPABASE_URL`, mais ws/wss da mesma origem). `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. `form-action` com `'self'` e o Supabase Auth. `upgrade-insecure-requests` só em HTTPS.
- **Renderização por requisição**: no build, a casca estática do PPR saía sem nonce e todos os scripts seriam bloqueados. O layout raiz agora faz `await connection()` e exporta `instant = false` (decisão D1 em docs/seguranca/decisoes.md).
- **Cabeçalhos fixos**: `src/lib/security/headers.ts` (usado pelo `next.config.ts`): nosniff, Referrer-Policy, Permissions-Policy (câmera e localização em self, microfone bloqueado), X-Frame-Options DENY, COOP same-origin e HSTS de 2 anos só no build de produção.
- **Validação centralizada**: `src/lib/validation` (`lerFormulario`/`lerParametros`, `validarEntrada`/`validarFormulario`, `falhaDe`/`EstadoDaAcao`, `renomearCampos`). Todas as Server Actions (admin, ensaios, login) e o Route Handler `/auth/callback` passaram a usá-la. O erro sai padronizado em pt-BR, sem stack. `admin/estado.ts` agora só reexporta o utilitário.
- **test:security ampliada** (`scripts/test-security.mjs`): secretlint → audit → gitleaks (IGNORADA localmente sem o binário, obrigatória no CI) → build se faltar → `vitest run tests/security`. Virou a etapa "Segurança" do `npm run verify`, depois do build, e por isso também roda no CI. O CI coloca o gitleaks no PATH.
- Novos testes em `tests/security`: `cabecalhos` (todas as rotas × todas as situações de sessão), `acesso-por-perfil` (matriz rota × perfil, no proxy e na página, e perfis das Server Actions), `validacao-entrada` (varre e cobra o padrão), `segredos` (arquivos versionados, `.env*` ignorado, bundle `.next/static`), `use-cache` (S6) e `artefatos-e2e` (G2).
- **S6**: regra 11 na skill nextjs-app-router e teste que reprova `"use cache"`/`"use cache: remote"` em arquivo que importa `src/lib/data`.
- **G2**: no CI o Playwright roda sem trace, vídeo e captura. O storageState fica em `playwright/.auth` (no .gitignore e fora das pastas enviadas). Um passo novo do CI, "Remover sessão dos artefatos", apaga `*.zip`, `*.har` e storageState antes do upload.
- **G3**: já coberto pela tarefa 011 (`tests/security/secret-key-isolation.test.ts`); confirmado, sem mudança.
- **Pendência da 014 (cookies HttpOnly)**: decisão D2 em docs/seguranca/decisoes.md. HttpOnly fica mantido. O Realtime usará um token de vida curta entregue por um Route Handler autenticado (`setAuth`, só em memória). A fila offline enviará para `POST /api/sync` na mesma origem, sem falar direto com o Supabase, e preserva os itens se receber 401. Nada disso foi implementado aqui.
- Documentos: `docs/seguranca/base.md` (política, como ajustar o CSP para Storage, Realtime, Graph e Serwist, e a suíte) e `docs/seguranca/decisoes.md`. `docs/qualidade.md` passou a listar a nova etapa do verify.

### Casos de falha verificados (cada um revertido)
- Tirar X-Frame-Options de `headers.ts`: `cabecalhos.test.ts` reprova (14 testes).
- Segredo falso `sb_secret_…` num arquivo versionado: `segredos.test.ts` reprova. Observação: o secretlint (preset recomendado) **não** reconhece esse formato novo de chave do Supabase; o teste próprio cobre a lacuna.
- Tirar `exigirPerfilNaPagina` de `/inicio`: `rotas-protegidas` e `acesso-por-perfil` reprovam.
- Ler o formulário sem `validarFormulario` em `criarEnsaio`: `validacao-entrada.test.ts` reprova.
- Dependência alta/crítica: não simulada de novo; a etapa `npm audit --audit-level=high` é a mesma já verificada na tarefa 002 (lodash 4.17.20 reprovou).

### Arquivos
- Novos: `src/lib/security/csp.ts`, `src/lib/security/headers.ts`, `src/lib/validation/index.ts`, `scripts/test-security.mjs`, `tests/security/{cabecalhos,acesso-por-perfil,validacao-entrada,segredos,use-cache,artefatos-e2e}.test.ts`, `tests/unit/{csp,validation,test-security-script}.test.ts`, `tests/e2e/seguranca.spec.ts`, `docs/seguranca/base.md`, `docs/seguranca/decisoes.md`.
- Alterados: `src/proxy.ts`, `src/app/layout.tsx`, `next.config.ts`, `src/app/(app)/admin/actions.ts`, `src/app/(app)/admin/estado.ts`, `src/app/(app)/ensaios/actions.ts`, `src/app/(auth)/login/actions.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/redirect.ts` (`campoDeRetornoSchema`), `src/lib/data/trials.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.gitignore`, `package.json`, `scripts/verify.mjs`, `.claude/skills/nextjs-app-router/SKILL.md`, `docs/qualidade.md`, `tests/unit/{proxy,auth-actions,auth-callback,verify}.test.ts`, `tests/security/admin-acoes.test.ts`.

### Como testar
1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:security`, `npm run verify`.
2. Cabeçalhos na mão: `npm run build`, `npx next start -p 3300` e `curl -sD - http://localhost:3300/login`. Confira a CSP com nonce, HSTS e X-Frame-Options, e que todos os `<script>` têm `nonce=` igual ao do cabeçalho.
3. Com Docker: `npx supabase db reset`, `.env.local` com `AUTH_LOCAL_PASSWORD_LOGIN=true`, `npm run build` e `E2E_SUPABASE=true npx playwright test tests/e2e/seguranca.spec.ts` (telas logadas sem violação de CSP).
4. No CI: o passo do gitleaks põe o binário no PATH e o `test:security` dentro do verify passa a exigi-lo.
