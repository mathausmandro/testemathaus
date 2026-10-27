# 006 - Migration: estrutura do protocolo (fatores, tratamentos, parcelas, variáveis, avaliações)
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

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
