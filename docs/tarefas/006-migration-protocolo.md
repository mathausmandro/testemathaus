# 006 - Migration: estrutura do protocolo (fatores, tratamentos, parcelas, variáveis, avaliações)
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

## Objetivo
Criar as tabelas que descrevem o protocolo do ensaio, com RLS herdando a visibilidade por trial_members, para que as fases seguintes só gerem dados sobre elas.

## Escopo
Inclui:
- Tabelas factors, factor_levels, treatments (número, nome, produto, ingrediente ativo, dose, formulação, época e vínculo com níveis de fator), plots (número, bloco, tratamento, coordenadas no croqui, parcela principal para subdivididas), assessment_variables (nome, unidade, método, escala, mínimo e máximo), planned_assessments (variável, momento em dias após plantio ou aplicação, data calculada, responsável).
- Todas com trial_id (ou ligação direta ao ensaio), uuid, created_at e updated_at, timestamptz, chaves estrangeiras e índices.
- RLS: leitura para coordination e membros do ensaio; escrita somente coordination; sem DELETE de plots depois que existirem registros de campo (tratado em 007/008, aqui deixar a restrição preparada ou documentada).
- Colunas apenas estruturais; nenhuma regra de casualização ou de cálculo de datas (Fase 2).
- Seed fictício de um ensaio de teste com poucas parcelas.
- Testes pgTAP.

Não inclui: lógica de casualização, croqui, cronograma, cadastro via tela (Fase 2), tabelas de campo (007).

## Arquivos afetados
supabase/migrations/*_protocolo.sql, supabase/tests/*, supabase/seed.sql.

## Critérios de aceite
- [ ] supabase db reset e supabase test db passam.
- [ ] RLS ligada em todas as tabelas novas, sem using (true).
- [ ] field e home_office leem tratamentos, parcelas, variáveis e avaliações só dos ensaios atribuídos; de outro ensaio recebem zero linhas.
- [ ] field e home_office falham ao inserir, atualizar ou excluir nessas tabelas; coordination consegue.
- [ ] Usuário sem perfil não lê nenhuma das tabelas.
- [ ] Integridade: parcela só referencia tratamento do mesmo ensaio; variável com mínimo maior que máximo é rejeitada.
- [ ] Todos os campos de data/hora são timestamptz (ou date onde for só data prevista, justificado).

## Testes esperados
pgTAP: matriz por perfil e por pertencimento ao ensaio em cada tabela; restrições de integridade. Unitários: não se aplica. Performance: índices em trial_id e chaves de junção conferidos com EXPLAIN. Segurança: checklist Banco e RLS.

## Riscos e dependências
- Depende da 005. Risco: modelar a mais ou a menos o fatorial e as parcelas subdivididas; manter colunas anuláveis e simples, sem inventar regras.
- Dependência de decisão de domínio sobre protocolo (Fase 0).

## Dúvidas para o Mathaus
- Faixa mínima e máxima da variável é obrigatória ou opcional?
- A variável pode ter escala categórica (ex.: notas de 1 a 9) além de numérica? Quais tipos de variável existem (numérica, nota, texto, contagem)?
- O protocolo pode ser alterado depois que a coleta começa? Se sim, quais campos, e isso deve gerar histórico?
- Quantidade típica de parcelas e variáveis por ensaio (para dimensionar índices e testes de volume).

## Entrega (preenchido pelo desenvolvedor)

Não executado: requer Docker/Supabase local (orientação de 27/10/2026). Validação só estática (parser do Postgres 17 no Vitest).

### Arquivos alterados
- Novos: `supabase/migrations/20261027170100_protocolo.sql`, `supabase/tests/006_protocolo.test.sql`.
- Alterados: `supabase/seed.sql` (ENS-TESTE-01: 2 tratamentos, 4 parcelas em 2 blocos, 1 variável, 1 avaliação prevista; distribuição ilustrativa, não é casualização), `src/lib/data/database.types.ts`.

### O que foi feito
- Tabelas `factors`, `factor_levels`, `treatments`, `treatment_factor_levels` (vínculo tratamento x nível de fator), `plots`, `assessment_variables`, `planned_assessments`, todas com uuid, `trial_id`, `created_at`/`updated_at` timestamptz e gatilho de updated_at.
- Integridade por chave estrangeira composta `(id, trial_id)`: parcela só aponta tratamento e parcela principal do mesmo ensaio; nível, vínculo e avaliação prevista idem. CHECK `min_value <= max_value`; número de tratamento e de parcela únicos no ensaio; `days_after` e `reference_event` (`planting`/`application`) juntos ou ambos nulos.
- RLS em todas: leitura `has_trial_access(trial_id)` (coordination ou membro com papel); inserção, atualização e exclusão só coordination. anon sem privilégio; truncate revogado de authenticated. Políticas escritas explicitamente (sem bloco DO) para revisão e para o teste estático.
- Índices em `trial_id` (ou cobertos pelo único `(trial_id, number|name)`) e nas chaves de junção (`treatment_id`, `main_plot_id`, `variable_id`, `responsible_id`, `factor_level_id`).
- Exclusão de parcela com registro de campo: será bloqueada na 007 pela FK sem cascade de `field_records`.

### Como testar
- Aqui: `npm test` (sintaxe, RLS em toda tabela, tipos x migrations).
- Com Docker (pendente): `npx supabase db reset`, `npx supabase test db` (arquivo `006_protocolo.test.sql`: RLS e timestamptz, integridade, matriz coordination/field/home_office/sem perfil/anon x leitura/inserção/atualização/exclusão por ensaio atribuído e alheio).
- Performance (pendente): `explain analyze select * from plots where trial_id = ...` como field.

### Desvios e observações
- Criada a tabela de ligação `treatment_factor_levels` (não listada em CONTEXTO.md) para o "vínculo com níveis de fator" do escopo.
- Dose como `numeric` + `dose_unit` texto; época (`timing`), escala (`scale`), método e formulação como texto livre. Um tratamento tem um só produto nesta modelagem.
- `planned_date` é `date` (data prevista, só dia), conforme permitido no critério de aceite.
- Coordenadas do croqui como linha/coluna da grade (`grid_row`, `grid_column`).
- Não há regra de "um nível por fator em cada tratamento" nem de responsável ser membro do ensaio; ficam para a Fase 2 se o Mathaus confirmar.

### Dúvidas para o Mathaus (acréscimo do desenvolvedor)
- Um tratamento pode ser mistura de vários produtos (tanque)? Se sim, produtos viram tabela própria.
- A avaliação "dias após aplicação" refere-se a qual aplicação (primeira, cada uma)? Hoje só se guarda o evento de referência.
