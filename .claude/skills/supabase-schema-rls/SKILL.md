---
name: supabase-schema-rls
description: Use ao criar ou alterar tabelas, migrations, políticas de RLS, funções SQL ou gatilhos de histórico no Supabase deste projeto.
---

## Passos
1. Crie a migration com supabase migration new NOME. Nunca altere o banco só pelo painel.
2. Tabelas e colunas em inglês, snake_case, uuid, created_at e updated_at; datas em timestamptz.
3. Ligue RLS em toda tabela e negue por padrão.
4. Políticas por perfil (coordination, field, home_office), lendo o papel por uma função security definer, para não haver recursão em profiles.
5. Visibilidade de ensaio por trial_members, exceto coordination.
6. Em field_records e demais dados de campo: gatilho que grava em change_history autor, data, motivo, valor anterior e valor novo. change_history só aceita inclusão. Sem DELETE em registros de campo: anulação com motivo.
7. Escreva testes pgTAP em supabase/tests e rode supabase db reset e supabase test db.

## Cuidados
- Nunca use a chave secreta para contornar uma política que falha. Corrija a política.
- Teste: cada perfil tenta ler e gravar o que não deve, e precisa falhar.
