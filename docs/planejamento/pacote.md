# Pacote de implementação: Lovable e Claude Code (v2)

Versão 2, de 26/10/2026. Este pacote segue o Plano de Execução v2 e o substitui na parte de implementação. Copie cada bloco para um arquivo com o nome indicado.

## O que mudou em relação à versão anterior

- **Lovable só com dados fictícios:** o protótipo não cria tabelas nem conecta ao Supabase. O esquema oficial nasce como migrations no repositório, evitando duas fontes de verdade.
- **Perfis com um só nome:** coordination, field e home_office, no prompt, no CLAUDE.md, no AGENTS.md e nas skills.
- **Domínio em uma só variável:** ALLOWED_EMAIL_DOMAIN, lida no servidor e no banco. Saiu a VITE_ALLOWED_EMAIL_DOMAIN.
- **Nomes atuais:** Next.js 16 usa proxy.ts no lugar de middleware.ts; o Supabase usa chave publicável e chave secreta no lugar de anon e service_role.
- **Ambientes:** Supabase local para desenvolver e testar; projeto de teste na nuvem para as prévias da Vercel.
- **Modelo de dados completo e perfil home office definido** (confere e pede correção, sem editar dado de campo).
- **Offline e push no iPhone, sessão expirada, fuso horário, LGPD e histórico imutável** entram nas regras e nas skills.
- **Papéis de agentes isolados:** análise, desenvolvimento, QA, performance e segurança, documentados no AGENTS.md.
- **Arquivos de texto com quebras de linha preservadas,** prontos para copiar.

## Parte 1: Prompt para o Lovable

Cole o texto desta parte no Lovable. Se ficar longo demais, envie em duas mensagens: primeiro até a seção 5 e depois o restante.

### Início do prompt

Crie a interface (front-end) de uma plataforma web para gestão de ensaios agronômicos de pesquisa. Todo o texto da interface em português do Brasil. Use React com TypeScript, Tailwind CSS e componentes shadcn/ui. O app deve ser responsivo, com prioridade para o celular nas telas de campo. Este é um protótipo visual: ele será migrado depois para Next.js por um desenvolvedor.

### 1. Contexto do produto

Um pesquisador agronômico coordena ensaios com equipe de campo e pessoas em home office. A partir de um protocolo padrão, o sistema gera casualização, croqui, cronograma, fichas de avaliação e caderno de campo. A equipe de campo coleta dados por parcela no celular, inclusive sem internet. O home office confere os dados em tempo real. No fim, o sistema gera a base de um relatório técnico agronômico.

### 2. Dados e integrações (importante)

- Não conecte a nenhum banco de dados e não crie tabelas. Use apenas dados fictícios.
- Crie uma camada de serviços (pasta services) com funções tipadas e assíncronas para cada entidade, que leem e gravam os dados fictícios. Os componentes nunca acessam os dados diretamente, só por esses serviços. Depois, os serviços serão trocados pela implementação real.
- Simule o login: botão "Entrar com Microsoft" que leva a um seletor de perfil de demonstração (coordination, field, home_office ou sem perfil).
- Mostre uma tela de "E-mail não permitido" e uma de "Aguardando liberação de acesso" (pessoa sem perfil).
- Não use variáveis de ambiente para o domínio de e-mail nem coloque chaves no código.

### 3. Perfis de acesso

- coordination (Coordenação): cria ensaios, atribui perfis e ensaios, vê e edita tudo; corrige dados com motivo.
- field (Campo): vê os ensaios atribuídos, registra avaliações, aplicações e ocorrências, anexa fotos e corrige os próprios registros com motivo.
- home_office (Home office): vê os ensaios atribuídos, confere qualidade, gera relatórios e pede correção ao campo. Não edita dado de campo.
- O menu, os botões e as rotas se adaptam ao perfil. Nenhum perfil exclui registro de campo: só anula com motivo.

### 4. Telas a criar

- Entrada: botão "Entrar com Microsoft", logotipo e aviso de acesso restrito à empresa.
- Painel inicial: cartões com ensaios ativos, avaliações de hoje, pendentes e atrasadas; "Minhas atividades da semana"; gráfico de andamento por ensaio; atalhos.
- Lista de ensaios: código, cultura, contratante, local, status e progresso, com busca e filtros.
- Novo ensaio / protocolo, em etapas: identificação (código, contratante, cultura, local, responsável técnico, datas); delineamento (DBC, DIC, fatorial, parcelas subdivididas; tratamentos, repetições, tamanho de parcela, área útil; fatores e níveis quando fatorial ou subdividida); tratamentos (tabela editável: número, nome, produto, ingrediente ativo, dose, formulação, época); variáveis de avaliação (nome, unidade, método, escala, valor mínimo e máximo); avaliações previstas (variável, momento em dias após plantio ou aplicação, responsável); manejo. Salvar rascunho e usar o protocolo padrão como modelo.
- Detalhe do ensaio: abas Resumo, Protocolo, Equipe, Croqui, Parcelas, Cronograma, Avaliações, Aplicações, Ocorrências, Fotos e Relatório.
- Croqui: parcelas em blocos, com número e cor por tratamento, legenda, botão "Gerar casualização" mostrando a semente do sorteio, e exportação em PDF. Tocar numa parcela abre os detalhes.
- Cronograma: calendário e lista de aplicações e avaliações, com status (a fazer, feito, atrasado) e responsável, em horário de Brasília.
- Coleta de campo (a tela mais importante, para celular): escolher ensaio, avaliação e parcela por listas ou toque no croqui; campos grandes e uso com uma mão; teclado numérico; validação imediata de valor fora da faixa, parcela repetida e avaliação já preenchida; foto com data, hora e local; observação; botão "Salvar e ir para a próxima parcela"; barra de progresso (por exemplo, 18 de 48 parcelas).
- Modo offline: indicador de conexão, fila de envio com contador, tela "Pendentes de envio", aviso de sucesso ao sincronizar e aviso "Abra o app com internet para enviar" (no iPhone o envio não acontece com o app fechado). Simule a fila com IndexedDB.
- Registro de aplicação: equipamento, volume de calda, temperatura, umidade, vento, operador, horário, observações e fotos.
- Ocorrências: data, parcela opcional, descrição e foto.
- Conferência de qualidade (home office e coordenação): alertas de valores atípicos, parcelas faltantes, dados sem foto e avaliações atrasadas, com filtros e as ações "Marcar como conferido" e "Pedir correção ao campo".
- Painel de acompanhamento: avaliações feitas, pendentes e atrasadas por ensaio e por pessoa, com gráficos.
- Médias e relatório: tabela de médias por tratamento, exportação em CSV e editor do relatório com seções fixas (identificação, objetivo, metodologia, resultados, anexos) pré-preenchidas, com interpretação e conclusão destacadas para o pesquisador escrever. Exportar em PDF.
- Avisos e calendário: canais (push no celular, e-mail), antecedência, e bloco "Assinar minha agenda no Outlook" com link privado para copiar e botão para gerar novo link. Aviso de que o push no iPhone exige instalar o app na tela inicial. Sem WhatsApp.
- Administração (só coordenação): pessoas, atribuição de perfis e de ensaios, histórico de acessos.
- Histórico de alterações: em cada registro de campo, autor, data, motivo, valor anterior e valor novo.

### 5. Design e experiência

- Visual limpo, profissional e agrícola: verde-escuro, verde-folha, areia e cinza. Modo claro e escuro.
- Telas de campo com alto contraste (uso sob sol), botões grandes, textos legíveis e poucos passos.
- Menu lateral no computador e barra inferior no celular.
- Estados vazios amigáveis, esqueletos de carregamento e mensagens de erro claras.
- Acessibilidade: foco visível, rótulos nos campos e contraste adequado.
- Dados fictícios realistas (por exemplo, ensaio de soja com 5 tratamentos e 4 repetições em DBC), em um arquivo separado, fácil de remover.

### 6. Entidades (só como tipos TypeScript)

Crie tipos para: profiles, trials, trial_members, factors, factor_levels, treatments, plots, assessment_variables, planned_assessments, field_records, field_record_photos, applications, occurrences, quality_flags, change_history, notification_preferences e calendar_feed_tokens. Use nomes de campos em inglês e snake_case. O campo role de profiles aceita coordination, field, home_office ou vazio.

### 7. Organização do código

- Pastas: páginas, componentes, serviços, hooks, tipos e utilitários.
- Casualização, croqui e cálculo de cronograma em funções puras, em arquivos próprios, para irem depois ao servidor.
- Comentários curtos nos pontos que serão ligados depois: banco real, sincronização offline, push, e-mail, feed iCal e Microsoft Graph.

### 8. O que não fazer

- Não conectar banco nem criar tabelas.
- Não implementar WhatsApp.
- Não colocar chaves ou domínio de e-mail no código.
- Não permitir excluir registro de campo nem remover o histórico.

### 9. Ordem de entrega

Primeiro entrada, layout com menu e perfis de demonstração; depois lista de ensaios e assistente de novo ensaio; em seguida croqui, cronograma e coleta de campo; por fim conferência de qualidade, painel, relatório, avisos e administração. Ao concluir cada bloco, resuma o que foi feito e o que falta.

### Fim do prompt

Observação: o protótipo é referência visual e fonte de componentes. O banco, o login real e as regras de acesso são construídos no Next.js, conforme o plano.

## Parte 2: Arquivo CLAUDE.md

Salve na raiz do projeto com o nome CLAUDE.md.

```
# CLAUDE.md

Instruções para o Claude Code neste repositório. Leia este arquivo, AGENTS.md, docs/CONTEXTO.md e docs/PLANO.md antes de qualquer tarefa.

## O que é este projeto

Plataforma web para automatizar ensaios agronômicos: a partir de um protocolo padrão, gera casualização, croqui, cronograma, fichas de avaliação e caderno de campo; a equipe de campo coleta dados por parcela no celular (inclusive offline); o home office confere os dados; o sistema alimenta o relatório técnico agronômico. Dono do produto: Mathaus, pesquisador que coordena os ensaios.

## Stack

- Next.js 16 (App Router) com TypeScript, front e back no mesmo projeto (Server Components, Server Actions e Route Handlers)
- PWA instalável com Serwist (service worker) e IndexedDB para a fila offline
- Supabase: Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron
- Login Microsoft (Entra ID, tenant único), restrito ao domínio de e-mail da empresa
- Vercel (plano pago) para hospedagem
- Docker para o app local; Supabase CLI para o banco local
- Protótipo de interface feito no Lovable (React com Vite, dados fictícios), usado como referência e fonte de componentes

## Comandos

- Instalar: npm ci
- Desenvolvimento: npm run dev
- Build: npm run build
- Lint e tipos: npm run lint e npm run typecheck
- Testes unitários: npm test
- Testes de ponta a ponta: npm run test:e2e
- Testes de acesso no banco: supabase test db
- Auditoria de performance: npm run test:perf
- Auditoria de segurança: npm run test:security
- Supabase local: supabase start, supabase db reset, supabase migration new NOME
- Docker: docker compose --profile dev up --build (ou --profile prod)

## Variáveis de ambiente

- NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: públicas
- SUPABASE_SECRET_KEY: só servidor e Edge Functions
- ALLOWED_EMAIL_DOMAIN: só servidor e banco; valor pendente
- .env.example versionado com os nomes; .env.local fora do repositório

## Regras inegociáveis

1. Segurança fica no banco. Toda tabela com dado de ensaio tem RLS ligada, nega por padrão e tem políticas por perfil. Nunca confie só na tela.
2. SUPABASE_SECRET_KEY só existe no servidor. Nunca em código de cliente, nunca em variável NEXT_PUBLIC, nunca no repositório, nunca na imagem Docker.
3. Chamadas ao Supabase passam pela camada de acesso a dados em src/lib/data, tipada.
4. Toda mudança de esquema é uma migration em supabase/migrations. Nunca altere o banco só pelo painel.
5. Dados de campo têm histórico imutável: toda edição grava autor, data, motivo, valor anterior e valor novo em change_history, que só aceita inclusão. Registros de campo não são excluídos; são anulados com motivo.
6. Acesso exige domínio de e-mail permitido E perfil atribuído pela coordenação. Perfis: coordination, field, home_office.
7. Ensaios só são visíveis a quem está em trial_members, exceto coordination.
8. A casualização grava a semente do sorteio e é reproduzível.
9. Fotos e relatórios em storage privado, com links temporários.
10. A fila offline nunca perde dado: só remove após confirmação do servidor e usa id gerado no aparelho para não duplicar.
11. Datas em timestamptz, exibidas em America/Sao_Paulo. pg_cron roda em UTC.
12. Interface em português do Brasil. Tabelas e colunas em inglês, snake_case.
13. Em dúvida sobre regra agronômica, estatística ou protocolo, pare e pergunte ao Mathaus.

## Como trabalhar

- Siga as fases de docs/PLANO.md, na ordem, e os papéis de agentes do AGENTS.md.
- Entregas pequenas, um commit por unidade lógica, mensagens claras.
- Testes junto com o código: acesso por perfil, casualização, cronograma e fila offline.
- Rode lint, tipos e testes antes de dizer que terminou.
- Ao terminar uma tarefa, atualize a seção Status de docs/PLANO.md.

## Pendências conhecidas

- Domínio de e-mail da empresa: não informado. Não fixe valor no código.
- Registro do app no Entra ID e Microsoft Graph: aguardando a TI.
- Ensaio piloto: a definir.
- WhatsApp: adiado de propósito. Não implementar.
```

## Parte 3: Arquivo AGENTS.md

Salve na raiz do projeto com o nome AGENTS.md.

```
# AGENTS.md

Guia para qualquer agente de código neste repositório. O CLAUDE.md tem as regras completas.

## Leitura obrigatória antes de agir

1. CLAUDE.md
2. docs/CONTEXTO.md: domínio agronômico, perfis, fluxo e glossário
3. docs/PLANO.md: fases, entregas e critérios de pronto

## Estrutura

- src/app: rotas do Next.js por área (login, ensaios, coleta, aplicações, painel, relatórios, admin) e Route Handlers em src/app/api
- src/proxy.ts: bloqueio de páginas sem sessão ou sem perfil (Next.js 16)
- src/lib/data: camada única de acesso a dados, tipada
- src/lib/design: casualização, croqui e cronograma (funções puras e testadas)
- src/lib/offline: fila offline e sincronização
- src/components: componentes e formulários
- supabase/migrations: migrations SQL
- supabase/tests: testes de acesso por perfil (pgTAP)
- supabase/functions: Edge Functions (avisos, feed iCal, Microsoft Graph)
- tests/e2e, tests/perf, tests/security: testes de ponta a ponta, performance e segurança
- docs: contexto, plano, decisões e relatórios dos papéis
- .claude/agents: definição dos papéis
- .claude/skills: skills do projeto

## Papéis de agentes (padrão do projeto)

Cada tarefa passa pelos papéis abaixo, sempre como subagentes separados. Um papel não faz o trabalho de outro. A troca entre papéis é por documento em docs/, nunca por memória de conversa.

| Papel | Faz | Não faz | Entrega | Modelo
| analista | Lê o plano, detalha a tarefa, critérios de aceite e riscos | Não escreve código | docs/tarefas/NNN-nome.md | sonnet
| desenvolvedor | Implementa a tarefa com testes unitários | Não aprova o próprio trabalho | Código, migrations e testes | sonnet; opus para RLS, login e sincronização offline
| qa | Roda lint, tipos e todos os testes, escreve testes de ponta a ponta faltantes | Não corrige código de produção | docs/qa/NNN.md | haiku para rodar e relatar; sonnet para escrever testes
| performance | Mede build, tamanho do bundle, Lighthouse e consultas lentas | Não muda regra de negócio | docs/performance/NNN.md | sonnet
| seguranca | Revisa RLS, autenticação, segredos, dependências e OWASP | Não corrige; abre achados | docs/seguranca/NNN.md | opus

Fluxo de cada tarefa: analista, desenvolvedor, qa, performance e seguranca. Achado de qa, performance ou seguranca volta ao desenvolvedor. A tarefa só está pronta quando os três relatórios estão aprovados.

## Perfis de acesso do sistema

- coordination: cria ensaios, atribui perfis e ensaios, vê e edita tudo, corrige dados com motivo
- field: vê ensaios atribuídos, grava avaliações, aplicações e ocorrências, anexa fotos, corrige os próprios registros com motivo
- home_office: vê ensaios atribuídos, confere qualidade, gera relatórios, pede correção; não edita dado de campo

## Definição de pronto

Lint, tipos e testes passam; acesso testado por perfil; migration incluída quando há mudança de esquema; relatórios de qa, performance e seguranca aprovados; PLANO.md atualizado.

## Quando parar e perguntar

Regra agronômica ou estatística incerta, mudança de política de acesso, novo serviço pago, qualquer coisa com dados reais de contratantes.
```

## Parte 4: Arquivos docs/CONTEXTO.md e docs/PLANO.md

### docs/CONTEXTO.md

```
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
```

### docs/PLANO.md

```
# Plano de implementação

Cerca de 20 semanas, começando por um ensaio piloto.

## Status

- [ ] Fase 0: Alinhamento
- [ ] Fase 1: Base, login e ambientes
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
```

## Parte 5: Skills do Claude Code

Cada skill vai em um arquivo SKILL.md dentro de .claude/skills/NOME-DA-SKILL/.

### supabase-schema-rls

```
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
```

### microsoft-auth-domain

```
---
name: microsoft-auth-domain
description: Use ao implementar ou alterar o login Microsoft, a restrição de domínio, a sessão por cookies, o proxy.ts e a atribuição de perfis.
---

## Passos
1. Provedor Microsoft (Entra ID) no Supabase Auth, com o app registrado pela TI como tenant único. Localmente, configure em supabase/config.toml.
2. Pacote @supabase/ssr: sessão em cookies seguros, renovada no servidor.
3. Domínio em duas camadas: tenant único e Before User Created Hook que recusa e-mail fora de ALLOWED_EMAIL_DOMAIN. Confira a claim xms_edov para e-mail verificado.
4. Primeiro login sem perfil; tela de aguardando liberação. Só coordination atribui perfil.
5. src/proxy.ts (Next.js 16) bloqueia páginas sem sessão ou sem perfil.
6. Cada chamada ao Supabase leva o token Bearer da sessão; a segurança real é a RLS.

## Cuidados
- Domínio lido de variável de ambiente; nunca fixe no código.
- Chave secreta nunca no navegador.
- Teste: e-mail de outro domínio é recusado; usuário sem perfil não vê dados.
```

### experiment-design

```
---
name: experiment-design
description: Use ao implementar delineamentos, casualização, croqui, mapa de parcelas e cálculo de cronograma.
---

## Passos
1. Cada delineamento como função pura em src/lib/design: DBC e DIC primeiro; depois fatorial (factors e factor_levels) e parcelas subdivididas.
2. A casualização recebe uma semente e a grava no ensaio. Mesma semente, mesmo resultado.
3. Mapa de parcelas: número, bloco, tratamento, coordenadas e parcela principal quando subdividida.
4. Croqui em SVG e PDF.
5. Cronograma a partir da data de plantio ou da primeira aplicação, em America/Sao_Paulo.
6. Fichas de avaliação e caderno de campo em PDF.

## Cuidados
- No DBC, cada tratamento aparece exatamente uma vez por bloco. Teste.
- Regra agronômica ou estatística incerta: pergunte ao Mathaus.
- Testes: contagem de parcelas, reprodutibilidade da semente, datas do cronograma.
```

### field-collection-offline

```
---
name: field-collection-offline
description: Use ao construir as telas de coleta no celular, a fila offline, a sincronização, fotos e validações na hora.
---

## Passos
1. PWA com Serwist; telas de coleta como componentes de cliente, em cache para abrir sem sinal.
2. Listas de parcela, tratamento e variável; teclado numérico; uso com uma mão.
3. Fila no IndexedDB; cada registro com id gerado no aparelho; envio idempotente (upsert pelo id).
4. Ao voltar o sinal: renovar a sessão, depois enviar a fila. Remover da fila só após confirmação.
5. iPhone não sincroniza em segundo plano: mostre pendências e peça para abrir o app com internet.
6. Conflitos: as duas versões vão para o histórico e abrem um alerta em quality_flags.
7. Fotos comprimidas, enviadas ao Storage privado; peça armazenamento persistente.
8. Validações na hora: faixa da variável, parcela repetida, avaliação já preenchida.

## Cuidados
- Teste de verdade sem sinal, em área de ensaio, com Android e iPhone.
- Nunca perca um dado coletado.
```

### notifications-calendar

```
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
```

### technical-report

```
---
name: technical-report
description: Use ao construir o painel, a conferência de qualidade, as tabelas de médias e o rascunho do relatório técnico.
---

## Passos
1. Painel em tempo real (Realtime): feitas, pendentes e atrasadas, por ensaio e por pessoa.
2. Conferência em quality_flags: atípicos, faltantes, sem foto, atrasadas; marcar como conferido ou pedir correção.
3. Médias por tratamento e exportação em CSV.
4. Relatório com seções fixas preenchidas automaticamente.
5. Interpretação e conclusão em branco, destacadas: são do Mathaus.

## Cuidados
- Estatística inferencial (ANOVA, testes de médias): confirme método e software com o Mathaus antes.
- O relatório nunca inventa interpretação.
```

### docker-local-env

```
---
name: docker-local-env
description: Use ao criar ou alterar Dockerfile, docker-compose, variáveis locais e testes em container.
---

## Passos
1. Dockerfile em etapas: dependências, desenvolvimento, build e imagem final sem privilégio de administrador.
2. docker compose com perfis dev e prod.
3. output standalone no next.config.
4. .env.example versionado; valores reais em .env.local, fora do repositório.
5. Banco local pelo Supabase CLI (supabase start); prévias usam o projeto de teste; nunca produção.
6. Na fase 6, rodar no container os testes de acesso, segurança e performance antes de cada publicação.

## Cuidados
- SUPABASE_SECRET_KEY nunca na imagem nem no repositório.
- Meta: dev novo sobe o sistema em menos de 15 minutos.
```

## Como começar com o Claude Code

- Crie uma pasta do projeto em Documentos e salve os arquivos acima com os nomes indicados.
- Abra o Claude Code nessa pasta. Ele lê o CLAUDE.md automaticamente.
- Primeiro pedido sugerido: leia CLAUDE.md, AGENTS.md, docs/CONTEXTO.md e docs/PLANO.md, resuma o que entendeu e proponha a execução da Fase 1 seguindo os papéis de agentes.
- Avance fase por fase, revisando cada entrega.
