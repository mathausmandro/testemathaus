# 004 - Supabase local e variáveis de ambiente
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: sonnet

## Objetivo
Ter o banco local rodando com supabase start, configuração versionada, variáveis de ambiente documentadas e o app capaz de ler a URL e a chave publicável do Supabase local.

## Escopo
Inclui:
- supabase init e supabase/config.toml versionado (portas, nomes de projeto, e-mail local via Inbucket/Mailpit para desenvolvimento).
- Script que gera .env.local a partir das chaves do supabase start (ou instruções claras), sem nunca versionar o arquivo.
- Validação das variáveis de ambiente no servidor com zod (módulo único, por exemplo src/lib/env.ts): falha com mensagem clara se faltar variável; SUPABASE_SECRET_KEY só acessível em código de servidor.
- Teste que impede importar o módulo de segredos em código de cliente.
- supabase/seed.sql com estrutura pronta (conteúdo de dados fictícios entra nas tarefas de migrations).
- Atualização do pipeline (002) para que a etapa pgTAP passe a ser obrigatória.

Não inclui: tabelas (005 em diante), login (012), projetos de teste e produção na nuvem (018).

## Arquivos afetados
supabase/config.toml, supabase/seed.sql, src/lib/env.ts, .env.example, scripts/setup-local.*, docs/ambiente.md, ci.yml.

## Critérios de aceite
- [ ] supabase start sobe os serviços e supabase status mostra URL e chaves; supabase db reset roda sem erro.
- [ ] .env.local é gerado localmente e não aparece em git status.
- [ ] Remover uma variável obrigatória faz o app falhar na inicialização com mensagem em português ou clara.
- [ ] Busca no código e no bundle do cliente não encontra SUPABASE_SECRET_KEY nem o valor da chave secreta.
- [ ] Etapa pgTAP do npm run verify roda (mesmo sem testes ainda) e é obrigatória no CI.
- [ ] Acesso por perfil: não se aplica (sem tabelas); registrado.

## Testes esperados
Unitários: validação de env (completa, faltando, valor vazio). e2e: fumaça. pgTAP: executa suíte vazia sem erro. Performance: tempo de supabase start registrado. Segurança: varredura do bundle de cliente por segredo; gitleaks.

## Riscos e dependências
- Depende da 001 (Supabase CLI e Docker) e usa a 002 para o ajuste do pipeline.
- Portas locais podem conflitar com outros serviços.

## Dúvidas para o Mathaus
- Nenhuma.

## Entrega (preenchido pelo desenvolvedor)
