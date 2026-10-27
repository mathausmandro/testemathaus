# Índice de tarefas

Fluxo de cada tarefa: analista, desenvolvedor, qa, performance, seguranca. Status possíveis: a fazer, em análise, em desenvolvimento, em QA, em performance, em segurança, devolvida, pronta.

## Fase 1: Base, login e ambientes

| Nº | Nome | Fase | Status | Modelo | Depende de | QA | Performance | Segurança |
| 001 | [Preparação do ambiente e esqueleto](001-ambiente-e-esqueleto.md) | 1 | pronta (Docker pendente) | sonnet | nenhuma | [aprovado](../qa/001.md) | [aprovado](../performance/001.md) | [aprovado](../seguranca/001.md) |
| 002 | [Pipeline de qualidade, segurança e performance](002-pipeline-de-qualidade.md) | 1 | pronta (CI real pendente) | sonnet | 001 | [aprovado](../qa/002.md) | [aprovado](../performance/002.md) | [aprovado](../seguranca/002.md) |
| 003 | [Docker do app e docker compose](003-docker-do-app.md) | 1 | pronta para validação (requer Docker) | sonnet | 001 | - | - | - |
| 004 | [Supabase local e variáveis de ambiente](004-supabase-local.md) | 1 | pronta para validação (requer Docker/Supabase) | sonnet | 001, 002 | - | - | - |
| 005 | [Migration: perfis, ensaios, atribuição e RLS base](005-migration-perfis-e-ensaios.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 004 | - | - | - |
| 006 | [Migration: estrutura do protocolo](006-migration-protocolo.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 005 | - | - | - |
| 007 | [Migration: dados de campo](007-migration-dados-de-campo.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 005, 006 | - | - | - |
| 008 | [Migration: histórico imutável](008-migration-historico-imutavel.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 007 | - | - | - |
| 009 | [Migration: avisos, push e tokens do feed iCal](009-migration-avisos-e-calendario.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 005 | - | - | - |
| 010 | [Testes pgTAP: matriz de acesso por perfil](010-matriz-de-acesso-pgtap.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 005 a 009 | - | - | - |
| 011 | [Camada de acesso a dados tipada](011-camada-de-dados.md) | 1 | pronta para validação (requer Docker/Supabase) | sonnet | 004, 005, 006 | - | - | - |
| 012 | [Login Microsoft configurável e sessão](012-login-microsoft-configuravel.md) | 1 | pronta para validação (requer Docker/Supabase e Entra ID) | opus | 004, 005 | - | - | - |
| 013 | [Hook de domínio de e-mail](013-hook-de-dominio-de-email.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 004, 005 | - | - | - |
| 014 | [proxy.ts e tela Aguardando liberação](014-proxy-e-aguardando-liberacao.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 011, 012 | - | - | - |
| 015 | [Administração de perfis e atribuição de ensaios](015-administracao-de-perfis-e-atribuicao.md) | 1 | pronta para validação (requer Docker/Supabase) | opus | 005, 008, 011, 014 | - | - | - |
| 016 | [Ensaio de teste e telas mínimas](016-ensaio-de-teste-e-telas-minimas.md) | 1 | a fazer | sonnet | 006, 011, 014 (015 em paralelo) | - | - | - |
| 017 | [Cabeçalhos, validação e suíte test:security](017-cabecalhos-validacao-e-testes-de-seguranca.md) | 1 | a fazer | opus | 001, 002, 014 | - | - | - |
| 018 | [Ambientes de teste e produção, Vercel e backup](018-ambientes-teste-e-producao.md) | 1 | a fazer | sonnet | 002, 004, 010 | - | - | - |
| 019 | [Onboarding em menos de 15 minutos](019-onboarding-menos-de-15-minutos.md) | 1 | a fazer | sonnet | 003, 004, 010, 016 | - | - | - |
| 020 | [Migração das telas do Lovable](020-migracao-das-telas-do-lovable.md) | 1 | a fazer (bloqueada: protótipo inexistente) | sonnet | protótipo do Lovable, 014, 016, 017 | - | - | - |

## Ordem sugerida
1. 001, depois 002, 003 e 004 (003 e 004 em paralelo).
2. 005, depois 006, 009 e 012/013 (em paralelo onde possível); 007 e 008 em seguida.
3. 010 assim que 005 a 009 estiverem prontas; 011 após 006.
4. 014, 015, 016 e 017.
5. 018 e 019 fecham a fase.
6. 020 quando o protótipo existir; nenhuma outra tarefa depende dela.

## Regras que valem para todas
- Toda tarefa que adiciona testes os inclui no npm run verify (002).
- Toda tarefa que toca dados tem critério de acesso por perfil e teste de pgTAP ou e2e correspondente.
- Nenhum valor de domínio de e-mail, tenant ou segredo no código ou no repositório.
