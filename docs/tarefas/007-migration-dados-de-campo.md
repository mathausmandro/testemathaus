# 007 - Migration: dados de campo (registros, fotos, aplicações, ocorrências, alertas)
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Criar as tabelas de dados coletados no campo e da conferência, com RLS por perfil e atribuição, anulação com motivo em vez de exclusão e id gerado no aparelho para idempotência.

## Escopo
Inclui:
- Tabelas field_records (parcela, avaliação prevista, valor, autor, data e hora, local, observação, id gerado no cliente como chave idempotente, status válido ou anulado, motivo da anulação, anulado por e quando), field_record_photos (caminho no Storage privado, data, hora, local), applications (equipamento, volume de calda, temperatura, umidade, vento, operador, horário), occurrences (data, parcela opcional, descrição), quality_flags (situação aberto, conferido, correção pedida; quem tratou).
- Bucket privado de fotos criado por migration, com política de Storage por perfil e ensaio (leitura e gravação só para quem pode ver/gravar no ensaio); limite de tamanho e tipos permitidos (apenas imagens).
- RLS conforme tabela de permissões: field e coordination gravam nos ensaios atribuídos (field corrige só os próprios registros); home_office lê, cria quality_flags (conferir, pedir correção) e não grava nem altera dado de campo; coordination corrige com motivo.
- Sem política de DELETE em nenhuma tabela de campo; anulação por UPDATE de status com motivo obrigatório (restrição check).
- Unicidade que impede duplicação por id do aparelho.
- Seed fictício de registros para testes locais.
- Testes pgTAP.

Não inclui: gatilhos de histórico (008), telas de coleta, fila offline, compressão de fotos (Fase 3).

## Arquivos afetados
supabase/migrations/*_dados_de_campo.sql, supabase/tests/*, supabase/seed.sql.

## Critérios de aceite
- [ ] supabase db reset e supabase test db passam.
- [ ] RLS ligada nas tabelas novas e nas políticas de storage.objects do bucket; sem using (true).
- [ ] field grava em ensaio atribuído e falha em ensaio não atribuído; field só altera os próprios registros.
- [ ] home_office não consegue inserir nem atualizar field_records, applications, occurrences nem fotos, mas consegue criar e tratar quality_flags nos ensaios atribuídos.
- [ ] Nenhum perfil consegue DELETE em tabelas de campo (tentativa falha para coordination também).
- [ ] Anular sem motivo é rejeitado; reenviar o mesmo id do aparelho não duplica (conflito tratado, sem erro silencioso).
- [ ] Usuário sem perfil não lê nada; arquivos do bucket não são listáveis nem acessíveis por URL pública.

## Testes esperados
pgTAP: matriz por perfil, atribuição e ensaio alheio para cada tabela e para o bucket; DELETE bloqueado; idempotência; anulação. Unitários: não se aplica. Performance: índices por parcela, ensaio e id do aparelho. Segurança: bucket privado, tipo e tamanho de arquivo, LGPD de localização das fotos só para perfis autorizados.

## Riscos e dependências
- Depende de 005 e 006. Risco alto: alteração de dado de campo sem histórico (resolvido junto com 008, que deve ser entregue antes de qualquer tela escrever nessas tabelas).
- Políticas de Storage são mais difíceis de testar com pgTAP; documentar a estratégia.

## Dúvidas para o Mathaus
- Quem pode anular um registro: só coordination, ou também o próprio field autor? Home_office só pede correção, correto?
- Em ocorrência e aplicação, quais campos são obrigatórios?
- A localização das fotos (GPS) pode ser vista por todos os perfis do ensaio ou só coordination? (LGPD)
- Existe prazo para o field corrigir o próprio registro?

## Entrega (preenchido pelo desenvolvedor)
