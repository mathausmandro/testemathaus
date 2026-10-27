# 013 - Before User Created Hook e restrição de domínio de e-mail
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

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
