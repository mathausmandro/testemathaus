# 007 - Migration: dados de campo (registros, fotos, aplicações, ocorrências, alertas)
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

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

Não executado: requer Docker/Supabase local (orientação de 27/10/2026). Validação só estática (parser do Postgres 17 no Vitest).

### Arquivos alterados
- Novos: `supabase/migrations/20261027170200_dados_de_campo.sql`, `supabase/tests/007_dados_de_campo.test.sql`.
- Alterados: `supabase/seed.sql` (2 registros, 1 aplicação, 1 ocorrência, 1 pedido de correção no ENS-TESTE-01), `src/lib/data/database.types.ts`.

### O que foi feito
- Tabelas `field_records`, `field_record_photos`, `applications`, `occurrences`, `quality_flags`, com `trial_id` direto e FKs compostas `(x_id, trial_id)` (registro só aponta parcela/avaliação/registro do mesmo ensaio). FKs sem cascade: ensaio, parcela ou avaliação com dado de campo não podem ser excluídos.
- Idempotência: `client_id uuid` único (gerado no aparelho) nas quatro tabelas de coleta. Reenvio comum falha com `23505`; a fila offline deve usar `insert ... on conflict (client_id) do nothing` e conferir pelo `client_id`.
- Anulação: `status` `valid`/`voided` + `voided_reason` (CHECK exige motivo não vazio), `voided_by`/`voided_at` preenchidos pelo gatilho. Registro nasce válido; anulado não volta nem é editado (`55000`).
- Gatilho `field_row_guard`: `created_by = auth.uid()` (o valor do cliente é ignorado; `default auth.uid()`), e `id`, `client_id`, `trial_id`, `created_by`, `created_at` imutáveis. `quality_flag_guard`: autor e "quem tratou/quando" (`handled_by`/`handled_at`) na troca de situação (`open`, `checked`, `correction_requested`).
- Sem DELETE: nenhuma política de DELETE; DELETE/TRUNCATE revogados de authenticated e service_role; gatilhos `prevent_delete`/`prevent_truncate` bloqueiam até o dono do banco.
- RLS: leitura `has_trial_access`; gravação `can_record_field_data` (field atribuído ou coordination); field só altera os próprios (`created_by = auth.uid()`); home_office não grava dado de campo, mas cria e trata `quality_flags` (`can_review_trial`); field só lê `quality_flags`.
- Storage: bucket `field-photos` privado, 10 MiB, só `image/jpeg|png|webp|heic|heif`. Caminho `<trial_id>/<field_record_id>/<arquivo>` (CHECK em `field_record_photos.storage_path`); políticas em `storage.objects` só de SELECT (membros/coordination) e INSERT (field atribuído/coordination), via `storage_object_trial_id(name)` (devolve null em caminho inválido). Sem UPDATE/DELETE: foto imutável.
- Índices: `trial_id`, `created_by`, parcela, avaliação e registro; `client_id` pelo índice único.

### Como testar
- Aqui: `npm test`.
- Com Docker (pendente): `npx supabase db reset`, `npx supabase test db` (arquivo `007_dados_de_campo.test.sql`: matriz por perfil/ensaio atribuído e alheio, idempotência, anulação, DELETE/TRUNCATE bloqueados inclusive para postgres, bucket privado e políticas de Storage).
- Storage: o pgTAP testa as políticas inserindo/lendo `storage.objects` como authenticated; tamanho, tipo e URL pública negada são aplicados pela API de Storage e precisam de teste e2e com Supabase local (upload de PDF e de arquivo > 10 MiB devem falhar; `getPublicUrl` deve dar 400/404).

### Desvios e observações
- O motivo de edição (obrigatório) e o histórico entram na 008; o teste da 007 já passa o motivo por `app.change_reason` para continuar válido com a 008 aplicada.
- Valor do registro em `value_numeric` e `value_text` (tipos de variável pendentes na 006); nenhum dos dois é obrigatório (parcela perdida pode ter só observação).
- Unidades fixadas no nome: `temperature_c`, `relative_humidity_pct`, `wind_speed_kmh`; volume de calda com `spray_volume_unit` livre.
- Anulação permitida ao field autor (corrigir os próprios registros) e à coordination, até a resposta do Mathaus.
- Localização (latitude/longitude) visível a todos os membros do ensaio, até a resposta sobre LGPD.
- Limite de 10 MiB por foto é provisório (a compressão vem na Fase 3).

### Dúvidas para o Mathaus (acréscimo do desenvolvedor)
- Pode haver mais de um registro válido por parcela e avaliação (várias plantas/amostras)? Hoje não há restrição de unicidade.
- Unidades padrão de vento (km/h ou m/s) e de volume de calda (L/ha?).
