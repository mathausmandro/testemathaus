# 008 - Migration: histórico imutável (change_history) e gatilhos
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Garantir no banco que toda alteração em dado de campo (e em dados sensíveis de protocolo e perfis, conforme decisão) grave autor, data, motivo, valor anterior e valor novo em change_history, que só aceita inclusão.

## Escopo
Inclui:
- Tabela change_history (tabela, id do registro, autor, data e hora timestamptz, motivo, valor anterior e novo em jsonb).
- Gatilho genérico (função) aplicado a field_records, field_record_photos, applications, occurrences e quality_flags; motivo obrigatório em UPDATE e em anulação, lido de configuração da transação ou de coluna dedicada, com falha clara quando ausente.
- Gatilho que também registra alterações de role em profiles e de membros de ensaio (rastreio de acessos), se aprovado pelo Mathaus (ver dúvidas); por padrão incluir.
- change_history: RLS com apenas INSERT/SELECT; sem UPDATE nem DELETE para nenhum perfil (inclusive coordination e dono do banco via REVOKE e gatilho de bloqueio); autor sempre vindo de auth.uid(), nunca de parâmetro do cliente.
- Visibilidade de leitura do histórico por perfil e por ensaio.
- Testes pgTAP.

Não inclui: telas de histórico, exportação para o caderno de campo (Fase 2 e 5).

## Arquivos afetados
supabase/migrations/*_historico_imutavel.sql, supabase/tests/*.

## Critérios de aceite
- [ ] supabase db reset e supabase test db passam.
- [ ] UPDATE em field_records por field/coordination com motivo gera linha em change_history com valor anterior e novo corretos e autor igual a auth.uid().
- [ ] UPDATE sem motivo é rejeitado.
- [ ] UPDATE e DELETE em change_history falham para todos os perfis, inclusive coordination.
- [ ] O autor gravado não pode ser forjado pelo cliente (tentativa de passar outro autor falha ou é ignorada).
- [ ] RLS: field e home_office leem o histórico apenas de ensaios atribuídos; usuário sem perfil não lê nada.
- [ ] Atualizar updated_at por si só não gera ruído de histórico (comportamento documentado).

## Testes esperados
pgTAP: gravação do histórico por tabela, motivo obrigatório, imutabilidade, autor não forjável, leitura por perfil. Unitários: não se aplica. Performance: custo do gatilho em lote (ex.: 1000 registros) medido. Segurança: tentativa de contornar com função security definer e com TRUNCATE; checklist Banco e RLS.

## Riscos e dependências
- Depende de 007. Risco: TRUNCATE, ou superusuário/migration futura que apague o histórico; mitigar com REVOKE e documentação.
- Fluxo de passar o motivo ao banco (parâmetro de sessão versus coluna) impacta a camada src/lib/data (011); definir e documentar.

## Dúvidas para o Mathaus
- O histórico também deve cobrir mudanças de perfil, atribuição a ensaios e alteração de protocolo? (sugestão: sim)
- Existe exigência de BPL/BPA sobre retenção do histórico (por quantos anos)?
- Quem pode ler o histórico: todos do ensaio ou só coordination e home_office?

## Entrega (preenchido pelo desenvolvedor)
