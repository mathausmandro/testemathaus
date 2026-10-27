---
name: nextjs-app-router
description: Use ao criar ou alterar páginas, layouts, Server Components, Server Actions, Route Handlers, proxy.ts, cache ou PWA no Next.js 16 deste projeto.
---

## Estrutura
- src/app/(auth): entrada e aguardando liberação. src/app/(app): áreas logadas (ensaios, coleta, painel, relatórios, admin).
- src/app/api: Route Handlers só para o que precisa de URL (feed iCal, webhooks, sincronização da fila offline).
- Mutações vindas de formulários: Server Actions em arquivos actions.ts, sempre com validação zod e checagem de sessão.
- src/proxy.ts: renova a sessão do Supabase e redireciona quem não tem sessão ou perfil.

## Regras
1. Server Components por padrão. "use client" só em componentes interativos e nas telas de coleta offline.
2. Dados sempre por src/lib/data, nunca chamadas soltas ao Supabase nas páginas.
3. Toda Server Action e Route Handler revalida sessão e perfil no servidor; esconder botão na tela não é segurança.
4. Validação de entrada com zod no servidor; a mesma schema pode ser usada no cliente.
5. Cliente Supabase do servidor criado por requisição (@supabase/ssr), nunca global.
6. Nada de segredo em variável NEXT_PUBLIC.
7. Telas de campo: componentes de cliente leves, imagens otimizadas, nada de bibliotecas pesadas no bundle inicial; carregue gráficos e PDF com import dinâmico.
8. PWA com Serwist: pré-cache das telas de coleta e dos recursos estáticos; nunca cache de respostas com dados de outro usuário.
9. Cabeçalhos de segurança em next.config: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (câmera e localização só no próprio site).
10. output standalone para a imagem Docker.

## Testes
- Unitários com Vitest e Testing Library.
- Ponta a ponta com Playwright, um fluxo por perfil.
- Performance com Lighthouse CI nas telas de campo.
