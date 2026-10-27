# 015 - Administração de perfis e atribuição de ensaios (coordenação)
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Permitir que a coordenação atribua perfis às pessoas e atribua pessoas a ensaios, com telas mínimas próprias e toda a validação no servidor e na RLS.

## Escopo
Inclui:
- Página src/app/(app)/admin/usuarios: lista de pessoas (incluindo as sem perfil, destacadas), atribuição e revogação de perfil (coordination, field, home_office) por Server Action com validação zod e checagem de perfil coordination no servidor.
- Atribuição e remoção de pessoas em trial_members, a partir do detalhe do ensaio ou da página de administração.
- Proteções: coordination não pode remover o próprio perfil se for o último coordination; confirmação para revogação.
- Registro das mudanças de perfil no histórico (conforme 008).
- Funções correspondentes em src/lib/data.
- Telas mínimas, em português do Brasil, sem depender do protótipo.

Não inclui: convite de usuários (o cadastro é pelo login Microsoft), perfis além dos três, edição de dados pessoais.

## Arquivos afetados
src/app/(app)/admin/*, src/lib/data/profiles.ts, src/lib/data/trial-members.ts, tests/e2e/*, tests/security/*.

## Critérios de aceite
- [ ] Coordination atribui e revoga perfil e atribui a ensaios; a mudança aparece para o usuário na próxima requisição.
- [ ] field e home_office recebem negação (servidor e banco) ao chamar as ações diretamente; a página de admin não abre para eles.
- [ ] Usuário sem perfil é liberado após a atribuição e passa a ver só os ensaios atribuídos.
- [ ] Retirar uma pessoa de um ensaio faz o ensaio desaparecer da lista dela (e2e).
- [ ] Não é possível deixar o sistema sem nenhum coordination.
- [ ] Alterações de perfil e atribuição geram linha em change_history com autor e motivo/contexto.
- [ ] Entradas são validadas com zod no servidor; valores de perfil inválidos são rejeitados.

## Testes esperados
Unitários: ações com validação e regras do último coordination. e2e: fluxo da coordenação e tentativas dos outros perfis. pgTAP: cobertos em 005 e 010 (acrescentar casos se surgirem). Performance: listagem de pessoas paginada. Segurança: escalada de privilégio, ação direta sem tela, CSRF das Server Actions.

## Riscos e dependências
- Depende de 005, 008, 011 e 014. Risco alto de escalada de privilégio.
- Como criar o primeiro coordination (bootstrap) precisa de procedimento seguro e documentado, sem credenciais no repositório.

## Dúvidas para o Mathaus
- Quem será o primeiro coordination em produção (e-mail) e como deve ser feita a primeira liberação?
- A coordenação pode ter mais de uma pessoa? Pode haver pessoas sem acesso a nenhum ensaio, mas com perfil?

## Entrega (preenchido pelo desenvolvedor)
