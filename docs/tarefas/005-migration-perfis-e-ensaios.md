# 005 - Migration: perfis, ensaios, atribuição e RLS base
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

## Objetivo
Criar o núcleo de acesso do banco: profiles, trials e trial_members, com as funções de papel e de pertencimento ao ensaio, RLS ligada e negada por padrão, e testes pgTAP. Todas as demais tabelas reutilizarão essas funções.

## Escopo
Inclui:
- Migration (supabase migration new) com: tipo/enum de role (coordination, field, home_office; vazio até a liberação), profiles (ligada a auth.users, e-mail, nome, role, created_at/updated_at), trials (código único, contratante, cultura, local, delineamento, datas previstas, status, semente da casualização anulável, responsável técnico), trial_members (trial_id, user_id).
- Criação automática de profiles com role nula quando um usuário é criado em auth.users (gatilho).
- Funções security definer com search_path fixo: current_role() (nome sugerido, evitar conflito com palavra reservada) e is_trial_member(trial_id); EXECUTE revogado de public e concedido só ao necessário.
- RLS conforme a tabela de permissões do plano: coordination vê e edita tudo; field e home_office veem apenas ensaios em que estão em trial_members; só coordination cria e edita ensaios e atribui perfis e membros; usuário sem perfil não lê nada além do próprio registro em profiles; ninguém altera o próprio role.
- Impedir que um usuário se auto-promova (coluna role protegida por política e gatilho).
- Seed fictício mínimo de usuários (um por perfil e um sem perfil) apenas para testes locais.
- Testes pgTAP em supabase/tests.

Não inclui: demais tabelas (006, 007, 009), change_history (008), telas, login.

## Arquivos afetados
supabase/migrations/*_perfis_e_ensaios.sql, supabase/tests/*, supabase/seed.sql, docs/decisoes (se houver nome de função a registrar).

## Critérios de aceite
- [ ] supabase db reset aplica a migration sem erro e supabase test db passa.
- [ ] RLS ligada em profiles, trials e trial_members (consulta a pg_class confirma) e nenhuma política usa using (true).
- [ ] coordination lê e grava em todos os ensaios; field e home_office só leem ensaios atribuídos e falham ao criar, editar ou excluir ensaio.
- [ ] Usuário sem perfil não lê ensaios nem outros profiles.
- [ ] Nenhum perfil consegue alterar o próprio role nem inserir/alterar trial_members, exceto coordination.
- [ ] Funções security definer têm search_path fixo e EXECUTE restrito.
- [ ] Nenhuma chave secreta é usada nos testes para contornar política.
- [ ] A criação do usuário gera profiles sem role (verificado em teste).

## Testes esperados
pgTAP: matriz completa (4 situações de usuário x leitura, inserção, atualização, exclusão nas 3 tabelas), auto-promoção bloqueada, recursão inexistente. Unitários: não se aplica. e2e: não se aplica ainda. Performance: EXPLAIN das consultas de listagem de ensaios com índice em trial_members(user_id, trial_id). Segurança: checklist Banco e RLS da skill security-engineer.

## Riscos e dependências
- Depende da 004. Risco crítico: recursão de política em profiles e escalada de privilégio por role.
- Lista de status e de delineamentos do ensaio é decisão de domínio (ver dúvidas); usar enum extensível por migration, sem inventar valores além dos já citados no plano (DBC, DIC, fatorial, parcelas subdivididas).

## Dúvidas para o Mathaus
- Lista de status do ensaio (ex.: rascunho, em andamento, concluído, cancelado?).
- Campos obrigatórios do ensaio no cadastro (código, contratante, cultura, local são obrigatórios?).
- Cada pessoa tem um único perfil, ou pode acumular (ex.: field e home_office)? O plano assume um perfil por pessoa.
- Cultura e contratante são texto livre ou listas controladas?

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (orientação de 27/10/2026). Migration, seed e pgTAP foram escritos e validados só estaticamente (parser real do Postgres 17 via libpg-query em WASM, no Vitest).

### Arquivos alterados
- Novos: `supabase/migrations/20261027170000_perfis_e_ensaios.sql`, `supabase/tests/005_perfis_e_ensaios.test.sql`, `src/lib/data/database.types.ts` (à mão, formato do gen types), `tests/unit/migrations.test.ts`.
- Alterados: `supabase/seed.sql` (4 usuários fictícios em `exemplo.test`, 2 ensaios, membros), `package.json`/`package-lock.json` (devDependency `libpg-query@17`, WASM, sem binário nativo).

### O que foi feito
- Enums `app_role` (coordination, field, home_office) e `trial_design` (dbc, dic, factorial, split_plot). `profiles.role` nula = aguardando liberação.
- `profiles`, `trials` (código único, contratante, cultura, local, delineamento, datas previstas, status, `randomization_seed`, responsável técnico) e `trial_members` (id uuid + único `(trial_id, user_id)`; índice `(user_id, trial_id)`).
- Gatilho `on_auth_user_created` cria o perfil com role nula.
- Funções security definer, `search_path = ''`, EXECUTE revogado de public/anon e concedido a authenticated/service_role: `current_app_role()` (current_role é reservado), `is_coordination()`, `is_trial_member(uuid)`, `has_trial_access(uuid)`, `can_record_field_data(uuid)`, `can_review_trial(uuid)` (as duas últimas já servem a 007).
- RLS ligada nas 3 tabelas, só políticas `to authenticated`, nenhuma `using (true)`. anon sem privilégio algum. Em profiles: `insert`/`delete` revogados de authenticated e `update` só nas colunas `full_name` e `role`.
- Auto-promoção bloqueada em duas camadas: política (só o próprio perfil ou coordination) + gatilho `protect_profile_columns` (só coordination muda role, nunca o próprio; id/e-mail imutáveis). Operações de sistema (postgres/service_role, sem auth.uid()) passam, para seed e administração.

### Como testar
- Aqui: `npm test` (tests/unit/migrations.test.ts: sintaxe de migrations, seed e pgTAP; RLS em toda tabela; sem `using (true)`; search_path em security definer; tipos x migrations).
- Com Docker (pendente): `npx supabase db reset`, `npx supabase test db` (arquivo `005_perfis_e_ensaios.test.sql`: estrutura, matriz coordination/field/home_office/sem perfil/anon x leitura/inserção/atualização/exclusão nas 3 tabelas, auto-promoção, recursão), `npx supabase gen types typescript --local` e comparar.
- Performance (pendente): `explain analyze select * from trials` como field; esperado uso de `trial_members_trial_user_key`/`trial_members_user_trial_idx` dentro de `has_trial_access`.

### Desvios e observações
- Status do ensaio é `text` com CHECK provisório (`draft`, `in_progress`, `completed`, `cancelled`, tirado do exemplo das dúvidas) em vez de enum: mudar a lista depois é um `alter table ... check`, sem a limitação de enum de não remover valor.
- `planned_start_date`/`planned_end_date` são `date` (só dia). timestamptz trocaria o dia ao converter para America/Sao_Paulo.
- Só `code` é obrigatório no ensaio; demais campos anuláveis até a resposta do Mathaus.
- `technical_lead` é texto livre (o responsável técnico pode não ser usuário do sistema).
- field e home_office veem só o próprio perfil (não os nomes dos colegas). Se as telas de conferência precisarem do nome do autor, abrir tarefa para expor nome por função/visão restrita.
- Seed sem senha (login é Microsoft); colunas de token vazias permitem link mágico local pelo Mailpit.

### Dúvidas para o Mathaus (acréscimo do desenvolvedor)
- Confirmar a lista provisória de status e os campos obrigatórios (hoje só o código).
- O responsável técnico é sempre um usuário do sistema (então vira referência a profiles) ou pode ser externo?
