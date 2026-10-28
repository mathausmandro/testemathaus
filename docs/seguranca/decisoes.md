# Decisões de segurança

Registro curto das decisões que afetam a segurança, com as alternativas consideradas. Cada item diz quando reavaliar.

## D1 - CSP com nonce e renderização por requisição (tarefa 017, 27/10/2026)

**Decisão.** A CSP usa um nonce por requisição, gerado em `src/proxy.ts` (padrão do Next.js 16), com `'strict-dynamic'` e sem `'unsafe-inline'` em scripts. Para o nonce chegar aos scripts, o layout raiz chama `await connection()` e exporta `instant = false`. Com isso, todas as páginas são renderizadas na requisição e não há casca estática do Partial Prerendering.

**Por quê.** Conferido no build: com `cacheComponents`, as páginas eram cascas pré-renderizadas (◐/○), e os `<script>` saíam **sem** nonce. Com `'strict-dynamic'`, o navegador bloquearia todos eles e o app ficaria sem JavaScript. Depois da mudança, todos os `<script>` e `<link rel=preload|stylesheet>` saem com o nonce da requisição (conferido com `curl` e pelo e2e `tests/e2e/seguranca.spec.ts`).

**Custo.** A página inicial e a de login deixam de sair do cache estático. Como quase todas as telas já dependiam de sessão (eram dinâmicas dentro do Suspense), o efeito prático é pequeno. O Lighthouse continua sendo cobrado no verify.

**Alternativas descartadas.**
- `'unsafe-inline'` em `script-src` (sem nonce): mantém o estático, mas tira a principal proteção contra XSS. Descartada (S2 pede CSP efetiva).
- SRI com hash (`experimental.sri`): mantém o estático, mas é experimental e não cobre os scripts inline do Next (hidratação do RSC). Reavaliar quando sair do experimental.

**Reavaliar** quando o Next permitir nonce em casca pré-renderizada ou quando o SRI ficar estável.

## D2 - Sessão em cookie HttpOnly e o cliente Supabase do navegador (pendência da 014, 27/10/2026)

**Situação.** Os cookies de sessão do Supabase são `HttpOnly; SameSite=Lax; Secure` (produção) (`src/lib/data/cookie-options.ts`). O JavaScript da página não lê o token, o que protege a sessão contra roubo por XSS. Consequência: o cliente do navegador (`src/lib/data/client/browser.ts`, `createBrowserClient`) **não enxerga a sessão** e funciona como anônimo. Hoje todo acesso autenticado passa pelo servidor (Server Components, Server Actions e Route Handlers), com a RLS aplicada pelo cliente da requisição.

**Decisão.** Manter HttpOnly. Nenhum código de cliente deve contar com sessão no `createBrowserClient`. A regra vale até as fases que precisam de conexão autenticada direto do navegador, que seguem o caminho abaixo. Nada disso foi implementado nesta tarefa.

**Caminho previsto.**

1. **Realtime (painel, Fase 5).** Um Route Handler autenticado (ex.: `GET /api/realtime-token`) revalida sessão e perfil no servidor e devolve **só o access token** de vida curta (o JWT atual da sessão, nunca o refresh token), com `Cache-Control: no-store`. O cliente chama `supabase.realtime.setAuth(token)` e renova antes de expirar, chamando o mesmo endpoint. Os canais usam Realtime Authorization (políticas RLS em `realtime.messages`) ou `postgres_changes`, que respeita a RLS das tabelas. O token fica só na memória (sem localStorage). A CSP já libera `wss://` do projeto Supabase.
2. **Fila offline (Fase 3).** O envio da fila **não** fala direto com o Supabase. A fila (IndexedDB) envia ao Route Handler `POST /api/sync` (mesma origem, cookie HttpOnly vai junto), que revalida sessão e perfil, valida cada item com zod (`src/lib/validation`) e grava pelo cliente da requisição (RLS), com id gerado no aparelho para idempotência (regra 10). Item só sai da fila depois da confirmação do servidor. Se a sessão tiver expirado durante o período sem sinal, a resposta é 401: a fila **preserva** os itens e a tela pede novo login (a renovação acontece pelo proxy na navegação seguinte). O service worker (Serwist) não guarda token nem respostas com dados de outro usuário.
3. **CSRF dessas rotas.** As rotas usam cookie, então cada uma confere `Origin` igual ao host e aceita só `POST` com `Content-Type: application/json`. As Server Actions já têm essa proteção do Next.

**Alternativa descartada.** Desligar o HttpOnly para o `createBrowserClient` ler a sessão (padrão do `@supabase/ssr`). Expõe access e refresh tokens a qualquer XSS. Fica descartada enquanto houver o caminho acima.

**Reavaliar** nas tarefas de Realtime (Fase 5) e da fila offline (Fase 3), com o papel seguranca.

## D3 - `use cache` e dados de sessão (S6, tarefa 017)

Dados de ensaio, perfil ou campo nunca usam `"use cache"` nem `"use cache: remote"`; só `"use cache: private"` ou nenhum cache. A regra está na skill nextjs-app-router e é cobrada por `tests/security/use-cache.test.ts`.

## D4 - Artefatos do e2e (G2, tarefa 017)

No CI não há trace, vídeo nem captura do Playwright. Um storageState de e2e autenticado fica em `playwright/.auth/` (no .gitignore e fora das pastas enviadas). O workflow apaga `*.zip`, `*.har` e storageState de `playwright-report/` e `test-results/` antes do upload. O e2e só usa o Supabase local com usuários fictícios. Cobrado por `tests/security/artefatos-e2e.test.ts`.

## D5 - Pendências da revisão de segurança 003-019 (28/10/2026)

Corrigidos na revisão pós-final: M1 (hook só azure fora do modo local, domínio conferido também no servidor e no proxy, runbook em docs/ambientes.md seção 1.1), M2 (`db-remoto.mjs` confere `supabase/.temp/project-ref` antes do push) e B5 (environment `teste` restrito à `main`, docs/ambientes.md seção 5). B1 virou bloqueio de go-live no checklist de docs/ambientes.md.

Ficam **registrados, sem implementação**, para tarefa futura (cada um precisa de decisão ou de tarefa própria):

| Id | Achado (docs/seguranca/003-019.md) | Quando tratar | Decisão pendente |
| --- | --- | --- | --- |
| B2 | Sessão do Supabase sobrevive à conta Microsoft desativada (refresh token sem expiração) | Antes do go-live (Fase 1/6) | Procedimento de desligamento (revogar perfil e encerrar sessões pelo admin) e *time-box* ou *inactivity timeout* de sessão em produção; definir os prazos com o Mathaus |
| B3 | Upload de fotos sem vínculo com o registro nem com o autor (caminho `<trial_id>/...` livre para qualquer field do ensaio) | Fase 3 (fotos e fila offline) | Política de storage exigindo `field_records.id` do mesmo ensaio criado por `auth.uid()`, nome com uuid do aparelho e validação do conteúdo da imagem no servidor |
| B4 | A pessoa edita o próprio `full_name` e pode se passar por outra na fila "Aguardando liberação" | Tarefa de ajuste da administração (Fase 1) | Destacar o e-mail como identificador na tela ou tirar `full_name` do UPDATE do próprio usuário |
| B6 | Localização precisa (6 casas) de pessoas guardada para sempre, inclusive em `change_history`, visível a home_office; EXIF das fotos | Fase 3, com o Mathaus (LGPD) | Finalidade, base legal e retenção; menos casas decimais; remover EXIF além do necessário; home_office precisa ver as coordenadas? |
