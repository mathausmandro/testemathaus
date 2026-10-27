# 005 - Migration: perfis, ensaios, atribuição e RLS base
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

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
