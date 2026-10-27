---
name: notifications-calendar
description: Use ao implementar avisos por push e e-mail, pg_cron, feed iCal e Microsoft Graph.
---

## Passos
1. pg_cron e pg_net chamam periodicamente a Edge Function de avisos. URL e chaves no Vault.
2. pg_cron roda em UTC; calcule as datas em America/Sao_Paulo.
3. A função busca atividades próximas e o responsável, envia push (Web Push com VAPID) e e-mail e grava em notification_log para nunca repetir.
4. Preferências por pessoa em notification_preferences; inscrições em push_subscriptions.
5. Feed iCal por pessoa com token de calendar_feed_tokens, revogável e rotacionável.
6. Microsoft Graph só após autorização da TI: permissão de aplicativo Calendars.ReadWrite, restrita ao grupo da equipe no Exchange Online.

## Cuidados
- WhatsApp adiado. Não implementar.
- Feed iCal sem dados sensíveis ou pessoais: só atividade, ensaio, parcela e horário.
- Push no iPhone só funciona com o app instalado na tela inicial.
