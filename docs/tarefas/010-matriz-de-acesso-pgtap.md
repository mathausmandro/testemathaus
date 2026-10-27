# 010 - Testes pgTAP: matriz de acesso completa por perfil
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

## Objetivo
Consolidar uma suíte pgTAP transversal que prove, para todas as tabelas, quem pode ler e gravar o quê, e fechar lacunas das tarefas 005 a 009, funcionando como porta de segurança do pipeline.

## Escopo
Inclui:
- Helpers de teste reutilizáveis (simular usuário por perfil via claims JWT, criar usuários e ensaios fictícios).
- Teste automático que lista todas as tabelas do schema public e falha se alguma não tiver RLS ligada (garante que tabelas futuras entrem na regra).
- Teste que falha se existir política com using (true) / with check (true) em tabela de dados.
- Matriz completa para os quatro tipos de usuário (coordination, field, home_office, sem perfil) e para ensaio atribuído e não atribuído, em todas as tabelas, com SELECT, INSERT, UPDATE e DELETE.
- Testes de vazamento entre ensaios (dois ensaios, usuário só em um).
- Teste de que funções security definer têm search_path fixo.
- Documentação da matriz esperada em docs/seguranca/matriz-acesso.md (tabela perfil x tabela x operação).

Não inclui: testes de interface, novos recursos de banco.

## Arquivos afetados
supabase/tests/*, docs/seguranca/matriz-acesso.md, pipeline (002) se necessário.

## Critérios de aceite
- [ ] supabase test db passa e é executado na etapa pgTAP do npm run verify e no CI.
- [ ] Criar uma tabela de teste sem RLS faz a suíte falhar (verificado e revertido).
- [ ] Criar uma política using (true) faz a suíte falhar (verificado e revertido).
- [ ] A matriz documentada coincide com os testes (cada célula da matriz tem pelo menos um teste).
- [ ] Todas as tentativas proibidas por perfil falham e todas as permitidas funcionam.
- [ ] Nenhum teste usa a chave secreta para contornar política.

## Testes esperados
pgTAP: toda a tarefa. Unitários: não se aplica. e2e: não se aplica. Performance: tempo da suíte registrado. Segurança: esta tarefa é a evidência para o relatório do papel seguranca.

## Riscos e dependências
- Depende de 005 a 009. Risco: testes frágeis dependentes de seed; usar fixtures criadas dentro de cada teste.

## Dúvidas para o Mathaus
- Confirmar a matriz de permissões do plano (a regra do home_office é a única marcada como pendente).

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (orientação de 27/10/2026). Validação só estática: o arquivo SQL passa no parser do Postgres 17 no Vitest; os corpos PL/pgSQL foram revisados à mão, porque o parser não os valida. Também não foi feita aqui a verificação de que uma tabela sem RLS ou uma política `using (true)` faz a suíte falhar (critério 2 e 3) nem a medição do tempo da suíte: ficam para o parceiro, com Docker.

### Arquivos alterados
- Novos: `supabase/tests/010_matriz_de_acesso.test.sql`, `docs/seguranca/matriz-acesso.md`.
- Alterados: `tests/unit/migrations.test.ts` (cada tabela do schema public precisa aparecer no pgTAP da matriz e no documento; a suíte cobre os cinco tipos de usuário e não usa chave secreta).
- Sem mudança de banco, então `src/lib/data/database.types.ts` não mudou nesta tarefa. Pipeline (002) sem mudança: `npm run verify` e o CI já rodam `supabase test db`, que inclui o arquivo novo.

### O que foi feito
- Helpers no schema `test_helpers`, que só existe dentro da transação do teste: `authenticate_as` (simula usuário por role + claims JWT), `attempt` (executa, mede `ok:N` ou `erro:SQLSTATE` e desfaz), `render`, `rid`/`uid`/`trial` (ids de fixture) e `visible_tables` (vazamento por `trial_id`).
- Fixtures criadas no próprio teste: dois ensaios (A atribuído, B não atribuído), um ensaio vazio e uma linha em cada tabela por ensaio. Cada tabela também tem uma linha "solta" (sem dependentes, para testar exclusão) e registros de outra pessoa do campo no ensaio A. Cada usuário tem uma linha de preferências, push, token e log.
- Matriz: 20 tabelas × SELECT/INSERT/UPDATE/DELETE × escopo (A/B, própria/alheia) × 5 tipos de usuário (coordination, field, home_office, sem perfil, anon). O resultado esperado de cada célula está em `test_helpers.rules`, igual a `docs/seguranca/matriz-acesso.md`.
- Cenários pedidos: usuário sem perfil (mesmo atribuído) não vê nem grava; usuário fora de trial_members (ensaio B) não vê nada; home_office tentando editar dado de campo (∅) e criar registro (42501); field lendo ensaio alheio (∅, e nenhuma tabela vaza linha de B); UPDATE/DELETE em change_history (42501 para todos, inclusive coordination); field editando registro de outra pessoa (∅).
- Regras transversais: RLS em toda tabela do schema public; nenhuma política `using (true)`/`with check (true)`; políticas só para authenticated; security definer com search_path fixo e sem EXECUTE para anon; anon sem privilégio em tabela; toda tabela do schema public com caso na matriz (tabela nova sem caso reprova); toda célula com resultado esperado para os 5 tipos de usuário; nenhuma regra órfã.

### Como testar
- Aqui: `npm test` (validação estática e cobertura do documento).
- Com Docker (pendente): `npx supabase db reset` e `npx supabase test db`. Para conferir os critérios 2 e 3, crie numa migration temporária `create table public.x (id int)` sem RLS e, depois, uma política `using (true)`. A suíte deve falhar nas duas; reverta em seguida. Registre o tempo da suíte em docs/qa.

### Desvios e observações
- Documento em `docs/seguranca/matriz-acesso.md`, como na tarefa. A orientação do orquestrador citava `matriz-de-acesso.md`; mantive o nome da tarefa.
- Excluir ensaio com dado de campo falha por FK (23503), mesmo para coordination; ensaio vazio é excluído. Está documentado na matriz.
- storage.objects fica fora desta matriz (coberto em 007).

### Dúvidas para o Mathaus (acréscimo do desenvolvedor)
- Mantida: confirmar a regra do home_office (lê ensaios atribuídos, confere qualidade, não edita dado de campo).
- Field deve ler o change_history dos ensaios atribuídos (hoje lê)?
