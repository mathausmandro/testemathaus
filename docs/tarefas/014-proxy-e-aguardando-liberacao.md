# 014 - proxy.ts, guarda de perfil e tela "Aguardando liberação"
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Bloquear páginas para quem não tem sessão ou perfil, renovar a sessão no servidor e revalidar sessão e perfil em Server Actions e Route Handlers, exibindo a tela "Aguardando liberação de acesso" para quem entrou sem perfil.

## Escopo
Inclui:
- src/proxy.ts (Next.js 16) que renova a sessão do Supabase, redireciona sem sessão para o login e, com sessão sem perfil, para a tela de aguardando liberação; rotas públicas explicitamente listadas (login, callback, ativos estáticos).
- Tela em src/app/(auth) "Aguardando liberação de acesso", em português do Brasil, com botão de sair e sem dados do sistema.
- Helper único de servidor (em src/lib/data ou src/lib/auth) para exigir sessão e perfil (e perfil específico) dentro de Server Actions e Route Handlers, retornando erro padronizado; esconder botão não é segurança.
- Layout das áreas logadas em src/app/(app) com navegação mínima própria conforme perfil (telas mínimas, independentes do protótipo).
- Garantir que respostas autenticadas não sejam cacheadas de forma compartilhada.

Não inclui: administração de perfis (015), páginas de negócio (016), hook de domínio (013).

## Arquivos afetados
src/proxy.ts, src/app/(auth)/aguardando/*, src/app/(app)/layout.tsx, src/lib/auth/* ou src/lib/data/*, tests/e2e/*, tests/security/*.

## Critérios de aceite
- [ ] Acesso a qualquer rota de src/app/(app) sem sessão redireciona para o login (e2e, para todas as rotas existentes).
- [ ] Usuário logado sem perfil só vê a tela de aguardando liberação; qualquer outra rota o redireciona para ela.
- [ ] Usuário com perfil acessa as áreas permitidas ao seu perfil; área de administração é negada a field e home_office no servidor (não apenas oculta).
- [ ] Server Actions e Route Handlers existentes rejeitam chamada sem sessão e sem perfil adequado (teste direto, sem passar pela tela).
- [ ] A rota do proxy não bloqueia ativos estáticos nem quebra o login; lista de exceções revisada.
- [ ] Cabeçalhos de cache impedem cache compartilhado de páginas autenticadas.
- [ ] Teste de segurança varre as rotas e confirma que nenhuma rota logada ficou fora do proxy.

## Testes esperados
Unitários: helper de exigir sessão e perfil; decisão de redirecionamento do proxy. e2e: um fluxo por situação (sem sessão, sem perfil, cada perfil). pgTAP: não se aplica. Performance: custo do proxy por requisição. Segurança: tentativa de acesso direto a rotas e a ações, bypass por caminho, cache de dados de outro usuário.

## Riscos e dependências
- Depende de 011 e 012. Risco alto: rota esquecida fora da proteção; cache de resposta de outro usuário; loop de redirecionamento.

## Dúvidas para o Mathaus
- Texto desejado para a tela de aguardando liberação e a quem a pessoa deve recorrer (contato da coordenação).

## Entrega (preenchido pelo desenvolvedor)
