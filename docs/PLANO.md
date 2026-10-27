# Plano de implementação

Cerca de 20 semanas, começando por um ensaio piloto.

## Status

- [ ] Fase 0: Alinhamento
- [ ] Fase 1: Base, login e ambientes (em andamento: 001 pronta em 27/10/2026, com Docker pendente pela TI; 003 e 004 escritas, prontas para validação com Docker/Supabase; 005 escrita, pronta para validação com Docker/Supabase; 002 pronta em 27/10/2026, CI real pendente do repositório remoto)
- [ ] Fase 2: Geração automática
- [ ] Fase 3: Coleta de campo
- [ ] Fase 4: Avisos e calendário
- [ ] Fase 5: Painel e relatório
- [ ] Fase 6: Endurecimento

## Fase 0: Alinhamento (semanas 1 e 2)
Protocolo padrão, delineamentos e variáveis com faixa de valores, piloto, pedidos à TI (registro no Entra ID, endereços de retorno, domínio, Microsoft Graph), aparelhos e sinal da equipe de campo, exigências de BPL/BPA, protótipo no Lovable.
Pronto quando: modelo aprovado, piloto escolhido, pedidos à TI enviados.

## Fase 1: Base, login e ambientes (semanas 3 a 6)
Next.js 16 com as telas do protótipo, Docker, Supabase local, migrations com todas as tabelas, RLS e trial_members, histórico imutável, login Microsoft com hook de domínio, perfis, testes pgTAP, projetos de teste e produção, backup.
Pronto quando: ensaio de teste cadastrado, cada perfil vê só o que deve, dev novo sobe o sistema em menos de 15 minutos.

## Fase 2: Geração automática (semanas 7 a 9)
Cadastro do protocolo, casualização com semente (DBC e DIC, depois fatorial e subdivididas), croqui, mapa de parcelas, cronograma, fichas e caderno de campo em PDF.
Pronto quando: o protocolo do piloto gera tudo sem edição manual e o Mathaus aprova.

## Fase 3: Coleta de campo (semanas 10 a 12)
Coleta no celular, fila offline com id do aparelho, renovação de sessão antes do envio, conflitos, fotos no Storage privado, validações, aplicações e ocorrências. Teste real sem sinal, incluindo iPhone.
Pronto quando: avaliação completa coletada sem sinal chega ao banco sem perda nem duplicação.

## Fase 4: Avisos e calendário (semanas 13 e 14)
pg_cron e Edge Function de avisos (push e e-mail), preferências, notification_log, feed iCal com token revogável, Microsoft Graph se liberado.
Pronto quando: avaliação marcada aparece na agenda e chega como aviso ao responsável certo, no horário de Brasília.

## Fase 5: Painel e relatório (semanas 15 a 17)
Painel em tempo real, conferência de qualidade, médias por tratamento, exportação CSV, modelo de relatório.
Pronto quando: relatório do piloto sai com métodos e resultados pré-preenchidos.

## Fase 6: Endurecimento (semanas 18 a 20)
Testes de acesso no Docker antes de cada publicação, teste de restauração, monitoramento, treinamento.
Pronto quando: restauração testada, testes passando, equipe do piloto treinada.
