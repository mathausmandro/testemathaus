# 011 - Camada de acesso a dados tipada (src/lib/data)
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: sonnet

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
