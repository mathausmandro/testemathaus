# 015 - Administração de perfis e atribuição de ensaios (coordenação)
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

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
- (desenvolvedor) Implementado sem limite de pessoas na coordenação e permitindo perfil sem ensaio atribuído, e também atribuir a um ensaio quem ainda está sem perfil (só passa a ver após a liberação, regra da 005). Confirmar.
- (desenvolvedor) Motivo: obrigatório (3 a 500 caracteres) para atribuir/alterar/revogar perfil e para retirar alguém de ensaio; opcional ao atribuir a ensaio (sem texto, grava o contexto "Atribuição ao ensaio pela coordenação"). Confirmar se a atribuição também deve exigir motivo.

## Entrega (preenchido pelo desenvolvedor)

Não executado aqui: migration, pgTAP e e2e autenticado (requer Docker/Supabase local, orientação de 27/10/2026).
Rodou aqui: npm run lint, typecheck, npm test (358 testes), test:security e npm run verify (pgTAP ignorada, sem Supabase local).

### Decisões
- Migration nova (as antigas não foram alteradas): `supabase/migrations/20261027170600_administracao_perfis.sql`.
  - Gatilho `zz_protect_last_coordination` (UPDATE de role e DELETE em profiles): nunca deixa o sistema sem coordination, nem por SQL direto. Usa `pg_advisory_xact_lock` para fechar a corrida em que duas coordenações se rebaixam ao mesmo tempo (a 005 só impedia alterar o próprio perfil) e confere de novo, depois da trava, se quem age ainda é coordination.
  - RPCs `admin_set_user_role`, `admin_add_trial_member` e `admin_remove_trial_member`, SECURITY INVOKER (a RLS e os gatilhos da 005/008 continuam valendo): existem só para gravar o motivo em `app.change_reason` na mesma transação da alteração, que é como o gatilho da 008 lê o motivo. Checam coordination, exigem motivo e devolvem P0002 quando não acham a linha.
- Server Actions (`src/app/(app)/admin/actions.ts`): `exigirPerfil(["coordination"])` antes de ler o formulário, zod, cliente da sessão (sem cliente admin/chave secreta). A regra do próprio perfil e da última coordenação é checada antes (mensagem clara) e de novo no banco. Revogação e retirada exigem confirmação (checkbox) também no servidor. CSRF: proteção nativa do Next.js (Origin = Host), sem `allowedOrigins`.
- A mudança vale na próxima requisição: proxy e `obterSessao` leem o perfil do banco a cada requisição.
- Histórico: listas em `/admin/usuarios` (últimas mudanças de perfil), `/admin/usuarios/[id]` (da pessoa) e `/admin/ensaios/[id]` (da equipe), com autor, data em America/Sao_Paulo e motivo.
- Coordination não aparece como opção para atribuir a ensaio (já vê todos).
- `traduzirErro`: P0002 vira "não encontrado" e 22023 vira "inválido".
- Seed: nova pessoa sem perfil `liberacao@exemplo.test` (id ...0006), reservada ao e2e da administração, para não interferir no e2e de `aguardando@`.
- Bootstrap da primeira coordenação documentado em `docs/auth-microsoft.md` (SQL Editor, uma vez por ambiente, sem e-mail no repositório).

### Arquivos
- Banco: `supabase/migrations/20261027170600_administracao_perfis.sql`, `supabase/tests/015_administracao_perfis.test.sql`, `supabase/seed.sql`.
- Dados: `src/lib/data/profiles.ts`, `src/lib/data/trial-members.ts` (novo), `src/lib/data/validation.ts` (novo), `src/lib/data/types.ts`, `src/lib/data/index.ts`, `src/lib/data/errors.ts`, `src/lib/data/database.types.ts` (Functions, escrito à mão).
- Regras e formatação: `src/lib/auth/regras-de-perfil.ts`, `src/lib/format.ts`.
- Telas: `src/app/(app)/admin/page.tsx`, `usuarios/page.tsx`, `usuarios/[id]/page.tsx`, `ensaios/page.tsx`, `ensaios/[id]/page.tsx`, `actions.ts`, `estado.ts`, `formularios.tsx`, `componentes.tsx`.
- Testes: `tests/unit/admin-actions.test.ts`, `tests/unit/admin-data.test.ts`, `tests/security/admin-acoes.test.ts`, `tests/e2e/admin.spec.ts`, `tests/e2e/rotas-protegidas.spec.ts` (rotas novas).
- Docs: `docs/auth-microsoft.md` (bootstrap), `docs/seguranca/matriz-acesso.md`.

### Como testar
1. Aqui: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:security`, `npm run verify`.
2. Com Docker: `npx supabase db reset`, `npx supabase test db` (inclui 015), `npx supabase gen types typescript --local` e comparar Functions (o gerador pode tipar `p_role` como não nulo; se tipar, manter `| null` ou trocar por cast em `setUserRole`).
3. e2e: `.env.local` com `AUTH_LOCAL_PASSWORD_LOGIN=true`, `npm run build`, `E2E_SUPABASE=true npx playwright test tests/e2e/admin.spec.ts` logo após o `db reset`. Os passos "o ensaio aparece/some na lista da pessoa" dependem da lista `/ensaios` da tarefa 016 e são pulados enquanto ela não existir.
4. Manual: entrar como `coordenacao@exemplo.test`, abrir Administração > Pessoas e perfis, liberar `liberacao@exemplo.test`, atribuí-la ao ENS-TESTE-02 em Equipes dos ensaios, retirar e revogar; conferir o histórico em cada tela.

### Pendências e observações
- Critérios "passa a ver só os ensaios atribuídos" e "o ensaio desaparece da lista dela" (e2e) ficam completos quando a 016 criar `/ensaios`; a regra em si já é garantida pela RLS (005/010).
- Observação para QA (fora do escopo, não corrigido): `supabase/tests/010_matriz_de_acesso.test.sql` cria fixtures com ids `10000000-...-0001` a `0005`, os mesmos do seed (1 a 4); com o seed carregado, o `insert into auth.users` da 010 deve falhar por chave duplicada. Verificar no `supabase test db`.
