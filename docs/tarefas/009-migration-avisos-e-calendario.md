# 009 - Migration: preferências, avisos, push e tokens do feed iCal
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Completar o esquema de dados da Fase 1 com as tabelas de avisos e calendário (apenas estrutura e RLS), para que o plano de migrations contenha todas as tabelas previstas, sem implementar o envio.

## Escopo
Inclui:
- Tabelas notification_preferences, notification_log, push_subscriptions e calendar_feed_tokens.
- RLS: cada pessoa lê e altera apenas as próprias preferências, inscrições push e tokens; notification_log legível pelo dono e pela coordenação, gravável só por serviço (sem política de escrita para usuários); coordination pode revogar tokens.
- calendar_feed_tokens: armazenar apenas o hash do token, nunca o valor em texto, com data de revogação.
- Sem dados pessoais desnecessários no log.
- Testes pgTAP.

Não inclui: pg_cron, Edge Function, envio de push ou e-mail, feed iCal (Fase 4).

## Arquivos afetados
supabase/migrations/*_avisos_calendario.sql, supabase/tests/*.

## Critérios de aceite
- [ ] supabase db reset e supabase test db passam.
- [ ] RLS ligada nas quatro tabelas, sem using (true).
- [ ] Uma pessoa não lê nem altera preferências, inscrições nem tokens de outra; coordination não lê o valor do token.
- [ ] Usuário sem perfil não acessa as tabelas de outros; field/home_office não escrevem em notification_log.
- [ ] Token do feed é guardado como hash; teste confirma que o texto original não existe no banco.
- [ ] Todas as datas são timestamptz.

## Testes esperados
pgTAP: matriz por perfil; propriedade de dados; hash do token. Unitários: não se aplica. Performance: índices por usuário e por data. Segurança: checklist Banco e RLS e itens do feed iCal (token longo, revogável).

## Riscos e dependências
- Depende de 005. Baixo risco funcional; risco de segurança em tokens.
- Pode rodar em paralelo a 006 a 008.

## Dúvidas para o Mathaus
- Antecedência padrão dos avisos e canais ativados por padrão (adiável para a Fase 4).
- Por quanto tempo guardar notification_log (LGPD)?

## Entrega (preenchido pelo desenvolvedor)
