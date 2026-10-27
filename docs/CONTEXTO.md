# Contexto do projeto

## Quem usa e para quê

O Mathaus é pesquisador e gerencia projetos de pesquisa agronômica, com equipe de campo e pessoas em home office. O objetivo é automatizar o processo, do protocolo ao relatório técnico. Hoje o trabalho é feito em papel e Excel. Um sistema pronto (Sislaudo, da Fitovision) foi tentado, mas era engessado. Por isso a solução é flexível: o protocolo define as regras e o resto é gerado a partir dele.

## Fluxo de ponta a ponta

1. Protocolo: vem da contratante ou é montado pelo Mathaus, no mesmo modelo padrão.
2. Geração automática: casualização com semente, croqui, mapa de parcelas, cronograma, fichas, caderno de campo.
3. Campo: coleta por parcela no celular, com fotos, data, hora e local, funcionando offline.
4. Home office: confere qualidade em tempo real e pede correção ao campo.
5. Análise e relatório: médias por tratamento, exportação para estatística, rascunho do relatório. Interpretação e conclusão são do Mathaus.

## Modelo do protocolo padrão

- Identificação: código, contratante, cultura, local, responsável técnico, datas previstas
- Delineamento: DBC, DIC, fatorial ou parcelas subdivididas; tratamentos, repetições, tamanho de parcela, área útil; fatores e níveis
- Tratamentos: número, nome, produto, ingrediente ativo, dose, formulação, época
- Variáveis: nome, unidade, método, escala, mínimo e máximo
- Avaliações previstas: variável, momento (dias após plantio ou aplicação), responsável
- Manejo: aplicações, tratos culturais, adubação, condições de aplicação

## Entidades do banco

profiles, trials, trial_members, factors, factor_levels, treatments, plots, assessment_variables, planned_assessments, field_records, field_record_photos, applications, occurrences, quality_flags, change_history, notification_preferences, notification_log, push_subscriptions, calendar_feed_tokens.

## Decisões tomadas

- Supabase em vez de Firebase, pela estrutura relacional, exportação e auditoria.
- Next.js 16 na Vercel, front e back no mesmo projeto. Protótipo visual no Lovable, só com dados fictícios.
- Segurança por RLS no banco; token Bearer da sessão em cada chamada.
- Login Microsoft (tenant único), domínio verificado por Before User Created Hook. Perfil atribuído pela coordenação.
- Perfis: coordination, field, home_office. Home office não edita dado de campo.
- Histórico imutável; registros anulados, nunca excluídos.
- Avisos por push e e-mail via pg_cron e Edge Functions. WhatsApp adiado.
- Calendário: feed iCal por pessoa primeiro; Microsoft Graph com permissão de aplicativo quando a TI autorizar.
- Supabase local para desenvolver e testar; projeto de teste para prévias; produção separada.
- Papéis de agentes isolados: analista, desenvolvedor, qa, performance, seguranca.
- Começar por um ensaio piloto pequeno.

## Limitações conhecidas

- iPhone: sem sincronização em segundo plano; push só com o app instalado na tela inicial.
- A sessão expira em cerca de uma hora; renovar exige internet.
- O Outlook atualiza o feed iCal a cada algumas horas.

## Glossário

- DBC: delineamento em blocos casualizados. DIC: delineamento inteiramente casualizado.
- Parcela: unidade experimental. Área útil: parte da parcela avaliada.
- Casualização: sorteio dos tratamentos nas repetições.
- Croqui: mapa do ensaio com a posição das parcelas.
- Caderno de campo: registro oficial do ensaio.
- RLS: Row Level Security, regras de acesso por linha no Postgres.
