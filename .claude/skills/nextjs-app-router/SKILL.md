---
name: nextjs-app-router
description: Use ao criar ou alterar páginas, layouts, Server Components, Server Actions, Route Handlers, proxy.ts, cache ou PWA no Next.js 16 deste projeto.
---

## Estrutura
- src/app/(auth): entrada e aguardando liberação. src/app/(app): áreas logadas (ensaios, coleta, painel, relatórios, admin).
- src/app/api: Route Handlers só para o que precisa de URL (feed iCal, webhooks, sincronização da fila offline).
- Mutações vindas de formulários: Server Actions em arquivos actions.ts, sempre com validação zod e checagem de sessão.
- src/lib/validation: utilitário único de entrada (lerFormulario/lerParametros + validarEntrada/validarFormulario) e de erro (falhaDe, EstadoDaAcao).
- src/lib/security: CSP com nonce (csp.ts, aplicada no proxy) e cabeçalhos fixos (headers.ts, usados no next.config.ts).
- src/proxy.ts: renova a sessão do Supabase e redireciona quem não tem sessão ou perfil.

## Regras
1. Server Components por padrão. "use client" só em componentes interativos e nas telas de coleta offline.
2. Dados sempre por src/lib/data, nunca chamadas soltas ao Supabase nas páginas.
3. Toda Server Action e Route Handler revalida sessão e perfil no servidor; esconder botão na tela não é segurança.
4. Validação de entrada com zod no servidor, sempre pelo utilitário src/lib/validation: guarda de sessão/perfil primeiro, depois lerFormulario/lerParametros e validarEntrada; erro devolvido só por falhaDe (mensagem fixa em pt-BR, sem stack nem mensagem do banco). Nada de form.get()/searchParams.get() solto em actions.ts e route.ts (tests/security/validacao-entrada.test.ts cobra). A mesma schema pode ser usada no cliente.
5. Cliente Supabase do servidor criado por requisição (@supabase/ssr), nunca global.
6. Nada de segredo em variável NEXT_PUBLIC.
7. Telas de campo: componentes de cliente leves, imagens otimizadas, nada de bibliotecas pesadas no bundle inicial; carregue gráficos e PDF com import dinâmico.
8. PWA com Serwist: pré-cache das telas de coleta e dos recursos estáticos; nunca cache de respostas com dados de outro usuário.
9. Cabeçalhos de segurança: os fixos (X-Content-Type-Options, Referrer-Policy, Permissions-Policy com câmera e localização só no próprio site, X-Frame-Options, HSTS em produção) em src/lib/security/headers.ts via next.config; a Content-Security-Policy tem nonce por requisição e é aplicada no src/proxy.ts. O layout raiz espera a requisição (connection) para o nonce chegar aos scripts: não crie casca estática no layout raiz. Domínio novo (Storage, Microsoft Graph etc.): ajuste src/lib/security/csp.ts conforme docs/seguranca/base.md. Nada de 'unsafe-inline' em script-src nem 'unsafe-eval' em produção.
10. output standalone para a imagem Docker.
11. Cache (cacheComponents ligado): dados de ensaio, de perfil, de campo ou qualquer coisa que dependa da sessão NUNCA usam "use cache" nem "use cache: remote" (a chave do cache não leva o usuário; o resultado de um usuário seria servido a outro sem passar de novo pela RLS). Use "use cache: private" ou nenhum cache. Arquivo que importa src/lib/data não pode ter "use cache" compartilhado (tests/security/use-cache.test.ts reprova). Achado S6, docs/seguranca/001.md.

## Testes
- Unitários com Vitest e Testing Library.
- Ponta a ponta com Playwright, um fluxo por perfil.
- Performance com Lighthouse CI nas telas de campo.
