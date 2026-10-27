# Matriz de acesso por perfil (tarefa 010)

Não executado: requer Docker/Supabase local. A matriz é verificada por `supabase/tests/010_matriz_de_acesso.test.sql` (`npx supabase test db`), que roda na etapa pgTAP do `npm run verify` e no CI.

Cada célula abaixo corresponde a uma linha de `test_helpers.rules` no teste. Se a regra mudar, mude os dois juntos. O teste unitário `tests/unit/migrations.test.ts` também falha se uma tabela do schema public faltar neste documento ou no teste pgTAP.

## Legenda

- **Tipos de usuário**: C = coordination; F = field; H = home_office; S = sem perfil (logado, `role` nula; nos testes, atribuído ao ensaio A); anon = sem login.
- **Escopos**: A = ensaio em que o usuário está em `trial_members` (coordination vê todos); B = ensaio em que não está; próprio/alheio = linha da própria pessoa ou de outra.
- **Resultados**: ✅ permitido; ⛔ negado com erro (42501: sem privilégio ou violação de RLS); ∅ filtrado pela RLS (a operação roda, mas não alcança nenhuma linha); FK = bloqueado por chave estrangeira.
- **anon**: ⛔ em todas as tabelas e operações (privilégios revogados). O teste confere todas as células.

## Ensaios e estrutura

| Tabela | Operação | C (A / B) | F (A / B) | H (A / B) | S (A / B) |
|---|---|---|---|---|---|
| trials | SELECT | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| trials | INSERT | ✅ | ⛔ | ⛔ | ⛔ |
| trials | UPDATE | ✅ / ✅ | ∅ / ∅ | ∅ / ∅ | ∅ / ∅ |
| trials | DELETE | FK / FK (ensaio com dado de campo); ✅ ensaio vazio | ∅ | ∅ | ∅ |
| trial_members, factors, factor_levels, treatments, treatment_factor_levels, plots, assessment_variables, planned_assessments | SELECT | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| (as mesmas) | INSERT | ✅ / ✅ | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ |
| (as mesmas) | UPDATE | ✅ / ✅ | ∅ / ∅ | ∅ / ∅ | ∅ / ∅ |
| (as mesmas) | DELETE | ✅ / ✅ | ∅ / ∅ | ∅ / ∅ | ∅ / ∅ |

## Dados de campo, conferência e histórico

| Tabela | Operação | C (A / B) | F (A / B) | H (A / B) | S (A / B) |
|---|---|---|---|---|---|
| field_records, field_record_photos, applications, occurrences | SELECT | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| (as mesmas) | INSERT | ✅ / ✅ | ✅ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ |
| (as mesmas) | UPDATE do próprio registro (com motivo) | ✅ / ✅ | ✅ / ∅ | ∅ / ∅ | ∅ / ∅ |
| (as mesmas) | UPDATE de registro de outra pessoa no ensaio A | ✅ | ∅ | ∅ | ∅ |
| (as mesmas) | DELETE | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ |
| quality_flags | SELECT | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| quality_flags | INSERT | ✅ / ✅ | ⛔ / ⛔ | ✅ / ⛔ | ⛔ / ⛔ |
| quality_flags | UPDATE | ✅ / ✅ | ∅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| quality_flags | DELETE | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ |
| change_history | SELECT | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| change_history | INSERT, UPDATE, DELETE | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ |

Registros de campo não são excluídos: são anulados por UPDATE com motivo. A inclusão em change_history é feita só pelos gatilhos.

## Perfis e dados pessoais

| Tabela | Operação | C (própria / alheia) | F (própria / alheia) | H (própria / alheia) | S (própria / alheia) |
|---|---|---|---|---|---|
| profiles | SELECT | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ |
| profiles | INSERT | ⛔ | ⛔ | ⛔ | ⛔ |
| profiles | UPDATE (nome) | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ |
| profiles | DELETE | ⛔ | ⛔ | ⛔ | ⛔ |
| notification_preferences, push_subscriptions | SELECT | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ |
| (as mesmas) | INSERT | ✅ / ⛔ | ✅ / ⛔ | ✅ / ⛔ | ⛔ / ⛔ |
| (as mesmas) | UPDATE | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| (as mesmas) | DELETE | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| calendar_feed_tokens | SELECT (metadados) | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ |
| calendar_feed_tokens | SELECT de token_hash | ⛔ | ⛔ | ⛔ | ⛔ |
| calendar_feed_tokens | INSERT | ✅ / ⛔ | ✅ / ⛔ | ✅ / ⛔ | ⛔ / ⛔ |
| calendar_feed_tokens | UPDATE (revogar) | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ∅ / ∅ |
| calendar_feed_tokens | DELETE | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ | ⛔ / ⛔ |
| notification_log | SELECT | ✅ / ✅ | ✅ / ∅ | ✅ / ∅ | ✅ / ∅ |
| notification_log | INSERT, UPDATE, DELETE | ⛔ | ⛔ | ⛔ | ⛔ |

Mudança de `role` em profiles (só coordination, nunca a própria) está em `005_perfis_e_ensaios.test.sql`. As RPCs de administração (`admin_set_user_role`, `admin_add_trial_member`, `admin_remove_trial_member`, SECURITY INVOKER, motivo obrigatório) e a garantia de ao menos uma coordination estão em `015_administracao_perfis.test.sql`. notification_log é gravado só pelo serviço (service_role, Fase 4).

## Regras transversais verificadas

- Toda tabela do schema public tem RLS ligada.
- Nenhuma política usa `using (true)` ou `with check (true)`.
- Toda política do schema public vale só para `authenticated`.
- Toda função security definer do schema public tem `search_path` fixo e não pode ser executada por anon.
- anon não tem privilégio em nenhuma tabela do schema public.
- Toda tabela do schema public tem casos de SELECT, INSERT, UPDATE e DELETE na matriz. Tabela nova sem caso faz a suíte falhar.
- Vazamento entre ensaios: para field, home_office e sem perfil, nenhuma tabela com `trial_id` mostra linha do ensaio não atribuído. Sem perfil também não vê nada do ensaio em que está atribuído. Coordination vê o ensaio B em todas as tabelas.
- Nenhum teste usa a chave secreta nem service_role. Os perfis são simulados com `role authenticated` e claims JWT.
- Toda tentativa é desfeita depois de medida, para não interferir na próxima.

## Fora desta matriz

- storage.objects (bucket `field-photos`): coberto em `007_dados_de_campo.test.sql`.
- Pendente com o Mathaus: confirmar a regra do home_office (única marcada como pendente no plano) e se field deve ler change_history.
