# 013 - Before User Created Hook e restrição de domínio de e-mail
Fase: 1 | Status: pronta para validação (requer Docker/Supabase) | Modelo do desenvolvedor: opus

> Parte não executada: requer Docker/Supabase local (pgTAP do hook, e2e de cadastro recusado) e o domínio real e a claim xms_edov (TI).

## Objetivo
Recusar no banco, no momento do cadastro, qualquer e-mail fora do domínio permitido, com o domínio vindo de configuração (ALLOWED_EMAIL_DOMAIN) e nunca fixado no código ou em migration.

## Escopo
Inclui:
- Função Postgres do Before User Created Hook, registrada em supabase/config.toml, que lê o domínio permitido de uma configuração do banco e recusa e-mails fora dele, com mensagem de recusa genérica.
- Tabela ou configuração protegida (somente leitura por serviço) espelhando ALLOWED_EMAIL_DOMAIN, alimentada por script/seed local a partir da variável de ambiente; sem valor fixo em migration.
- Comportamento definido para domínio ainda não configurado: padrão seguro (recusar todos os cadastros novos, exceto quando o modo de desenvolvimento local estiver ligado para os usuários de teste do seed).
- Comparação do domínio sem diferença de maiúsculas, rejeitando truques (subdomínios, sufixo parecido, múltiplos @).
- Aceitar apenas e-mail verificado quando o provedor informar (preparar leitura da claim xms_edov; teste com claims simuladas).
- Testes pgTAP chamando a função com eventos simulados.

Não inclui: registro no Entra ID, claim real xms_edov (depende da TI), proxy, telas.

## Arquivos afetados
supabase/migrations/*_hook_dominio.sql, supabase/config.toml, supabase/tests/*, scripts de seed da configuração, .env.example, docs/ambiente.md.

## Critérios de aceite
- [ ] Com domínio configurado como exemplo de teste, e-mail do domínio é aceito e e-mail de outro domínio é recusado, com teste pgTAP.
- [ ] Domínio parecido (subdomínio, sufixo, uso de duplo @, maiúsculas) é tratado corretamente (aceito ou recusado conforme regra documentada).
- [ ] Com o domínio não configurado, cadastros de produção são recusados; o comportamento local é documentado.
- [ ] Nenhum domínio real aparece em migration, código ou repositório (busca e gitleaks).
- [ ] Hook com EXECUTE restrito ao papel de autenticação do Supabase; função com search_path fixo.
- [ ] Tentativa de cadastro recusado não cria usuário nem profiles (teste local de ponta a ponta).
- [ ] Acesso por perfil: e-mail do domínio sem perfil continua sem ler dados (RLS).

## Testes esperados
pgTAP: matriz de e-mails aceitos e recusados, configuração ausente, claims simuladas. Unitários: não se aplica (ou utilitário de comparação, se existir no app). e2e: cadastro de e-mail fora do domínio falha no fluxo local. Performance: não crítico. Segurança: bypass por variações de e-mail, mensagem sem vazamento, execução restrita.

## Riscos e dependências
- Depende de 004 e 005; integra-se com 012. Risco alto: hook mal configurado pode bloquear todos os logins ou liberar todos.
- Domínio e claim real ficam pendentes da TI; os testes cobrem com valores fictícios.

## Dúvidas para o Mathaus
- Qual é o domínio de e-mail da empresa (apenas um ou mais de um)?
- Prestadores ou pesquisadores externos com outro domínio precisarão de acesso? (o plano prevê um único domínio)

## Entrega (preenchido pelo desenvolvedor)

### Arquivos
- supabase/migrations/20261027170500_hook_dominio_email.sql: schema `app_private` (fora da API), tabela de uma linha `app_private.auth_settings` (domínio com CHECK de formato, `local_test_mode`, `require_verified_email_claim`; RLS ligada, sem política, sem privilégio para anon/authenticated); funções puras `normalize_email_domain` e `email_matches_domain`; hook `public.hook_before_user_created(jsonb)` (security definer, search_path vazio, EXECUTE só para `supabase_auth_admin`); `public.set_auth_email_domain(text)` (só `service_role`).
- supabase/config.toml: `[auth.hook.before_user_created]` habilitado com `pg-functions://postgres/public/hook_before_user_created`.
- supabase/seed.sql: liga `local_test_mode` (sem domínio).
- scripts/set-allowed-email-domain.mjs + `npm run auth:domain`: grava ALLOWED_EMAIL_DOMAIN via RPC com a chave secreta (só servidor/terminal; nada impresso).
- src/lib/data/database.types.ts: as duas funções novas em Functions.
- supabase/tests/013_hook_dominio_email.test.sql: privilégios, configuração ausente, modo local, matriz de aceitos/recusados (maiúsculas, espaços, subdomínio, sufixo, prefixo, duplo @, vazio, nulo), mensagem pt-BR sem o domínio, claims xms_edov simuladas, chamadas negadas a anon/authenticated.
- tests/unit/hook-dominio.test.ts (estático: config.toml × função, grants, nenhum domínio fixo, cobertura do pgTAP, script); tests/e2e/hook-dominio.spec.ts (requer Supabase: cadastro fora do domínio recusado e sem usuário criado).
- docs/ambiente.md: seção "Login e domínio de e-mail".

### Regra documentada
- Aceito: e-mail com exatamente um @, sem espaços, cujo domínio é igual ao configurado (sem diferença de maiúsculas; espaços nas pontas ignorados; subendereço `+` aceito).
- Recusado: outro domínio, subdomínio, sufixo ou prefixo parecido, duplo @, e-mail vazio/ausente, evento sem usuário.
- Domínio não configurado: recusa tudo. Local (`local_test_mode`, só pelo seed): aceita também `exemplo.test` (domínio reservado, não real).
- Provedor azure: `xms_edov` falso recusa; ausente recusa só com `require_verified_email_claim = true`.
- Mensagem: "Cadastro não permitido. Entre com a conta Microsoft da empresa ou procure a coordenação." (HTTP 403).

### Como testar
- Aqui: `npm run lint`, `npm run typecheck`, `npm test` (inclui sintaxe da migration e do pgTAP pelo parser do Postgres 17), `npm run test:security`.
- Com Supabase local: `npx supabase db reset`, `npx supabase test db` (arquivo 013), `E2E_SUPABASE=true npx playwright test tests/e2e/hook-dominio.spec.ts`. Para o domínio: `ALLOWED_EMAIL_DOMAIN=<domínio fictício> npm run auth:domain`.

### Não executado / pontos a confirmar
- pgTAP e e2e (requerem Docker/Supabase).
- Caminho exato da claim `xms_edov` no evento do hook: o hook lê `user_metadata.custom_claims.xms_edov`, `user_metadata.xms_edov` e `identities[0].identity_data.custom_claims.xms_edov`; confirmar no primeiro login real e simplificar.
- Recusa no fluxo OAuth chega ao callback do app como `error` e aparece como mensagem fixa (012).
- Domínio único (coluna text). Se houver mais de um domínio (dúvida acima), trocar por lista em nova migration.
