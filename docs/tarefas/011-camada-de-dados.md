# 011 - Camada de acesso a dados tipada (src/lib/data)

> Parte não executada: requer Docker/Supabase local (gen types real, teste com sessão de cada perfil).
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: sonnet

## Objetivo
Criar a camada única e tipada em src/lib/data por onde todas as telas e Server Actions falam com o Supabase, com clientes de servidor e de navegador seguindo a skill nextjs-app-router, sem nenhuma chamada solta ao Supabase nas páginas.

## Escopo
Inclui:
- Geração dos tipos TypeScript a partir do banco local (supabase gen types) e script npm para regenerar; teste que falha se os tipos estiverem desatualizados em relação às migrations.
- Funções de criação do cliente Supabase: servidor (por requisição, @supabase/ssr, nunca global) e navegador; nenhuma função usa SUPABASE_SECRET_KEY, exceto um módulo isolado de servidor para tarefas administrativas explicitamente justificadas (por padrão, nenhum).
- Módulos iniciais: profiles (obter o próprio perfil) e trials (listar, obter, criar), retornando tipos de domínio e erros padronizados.
- Regra de lint (ou teste) que proíbe importar @supabase/supabase-js fora de src/lib/data.
- Validação zod nas entradas das funções de escrita.

Não inclui: login (012), proxy (014), telas (015, 016), módulos de campo (Fase 3).

## Arquivos afetados
src/lib/data/*, src/lib/supabase/* (ou dentro de data), package.json (script gen:types), eslint config.

## Critérios de aceite
- [ ] npm run typecheck passa com os tipos gerados do esquema real.
- [ ] Importar o Supabase fora de src/lib/data falha no lint (verificado com um arquivo de teste e revertido).
- [ ] Busca no código de cliente não encontra SUPABASE_SECRET_KEY.
- [ ] Teste unitário com Supabase local: com sessão de cada perfil, listar ensaios devolve apenas os atribuídos (coordination: todos).
- [ ] Acesso por perfil: field e home_office recebem erro tipado ao tentar criar ensaio; mensagem não vaza detalhes internos.
- [ ] Nenhuma função desliga a RLS ou usa chave de serviço.

## Testes esperados
Unitários: funções de dados com cliente simulado e com Supabase local; validação zod. e2e: coberto em 016. pgTAP: não se aplica (cobertos em 005 a 010). Performance: listagem de ensaios sem N+1. Segurança: sem segredo no cliente; erros sem vazamento.

## Riscos e dependências
- Depende de 004, 005 e 006 (tipos reais). A parte de tipos precisa ser regenerada a cada migration nova.
- Sonnet basta porque a segurança real está na RLS; qualquer uso da chave secreta exige revisão do papel seguranca.

## Dúvidas para o Mathaus
- Nenhuma.

## Entrega (preenchido pelo desenvolvedor)

### Arquivos
- src/lib/data: errors.ts (DataError, traduzirErro, mensagens pt-BR), types.ts, profiles.ts (getOwnProfile), trials.ts (listTrials, getTrial, createTrial + zod), index.ts.
- src/lib/data/client/browser.ts (só chave publicável), src/lib/data/server/server-client.ts (por requisição, cookies), src/lib/data/server/admin.ts (única referência à chave secreta; ninguém o usa).
- Repositórios recebem o cliente por parâmetro (testáveis sem banco). Env validado no primeiro uso de cada cliente (pendência da 004 resolvida); página inicial não usa cliente, então e2e e Lighthouse seguem passando.
- eslint.config.mjs: no-restricted-imports de @supabase/* fora de src/lib/data (verificado com arquivo temporário, removido). package.json: @supabase/ssr, @supabase/supabase-js, script gen:types.
- Testes: tests/unit/data.test.ts, data-clients.test.ts, data-boundary.test.ts (tipos × migrations, fronteira), tests/security/secret-key-isolation.test.ts (G3), tests/unit/env.test.ts ajustado (admin.ts pode citar a variável).

### Como testar
npm run lint, typecheck, npm test, npm run test:security, npm run verify (todos passaram; pgTAP ignorada).

### Não executado (requer Docker/Supabase)
- npm run gen:types e comparação com database.types.ts escrito à mão.
- Teste com sessão real de cada perfil (listar apenas atribuídos; field/home_office recebem forbidden ao criar): cobertura unitária só com cliente simulado.
- Varredura do bundle real por SUPABASE_SECRET_KEY segue para a 017.
