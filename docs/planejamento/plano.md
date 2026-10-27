# Plataforma de Automação de Ensaios Agronômicos: Plano de Execução (v2)

Versão 2, de 26/10/2026. Esta versão substitui a anterior e é a única referência de escopo, arquitetura e cronograma. O pacote para o Lovable e o Claude Code (v2) segue as mesmas decisões.

## O que mudou em relação à versão anterior

- **Um único cronograma:** cerca de 20 semanas, em sete fases. Saíram o plano de 16 semanas e o roteiro de 8 semanas da versão com Google Drive.
- **Seções da versão com Drive removidas:** o caminho com planilhas e Formulários fica só como histórico da decisão, e não como plano.
- **Nomes de perfis padronizados:** coordination, field e home_office, em todo o projeto.
- **Domínio de e-mail em uma só variável:** ALLOWED_EMAIL_DOMAIN, lida apenas no servidor e no banco.
- **Ambientes definidos:** Supabase local para desenvolvimento e testes, projeto de teste na nuvem para as prévias da Vercel, e produção separada.
- **Uma só fonte de verdade para o banco:** o protótipo do Lovable usa dados fictícios e não cria tabelas. O esquema oficial nasce como migrations no repositório.
- **Modelo de dados completo:** entram atribuição de ensaios, fatores, variáveis com faixa de valores, fotos, registro de avisos e tokens do feed iCal.
- **Perfil home office definido:** confere e pede correção, mas não edita dado de campo.
- **Limitações do celular tratadas:** iPhone sem sincronização em segundo plano, push só com o app instalado e sessão que expira no campo.
- **Novos itens:** LGPD, exigências de BPL/BPA, fuso horário e nomes atuais do Next.js 16 e das chaves do Supabase.

## Objetivo

A partir de um único protocolo padrão, gerar automaticamente toda a cadeia do ensaio: tratamentos, casualização, croqui, cronograma de manejo, avaliações, caderno de campo digital e a base de dados que alimenta o relatório técnico agronômico. A equipe de campo registra as informações por parcela no celular, inclusive sem sinal, e a equipe em home office acompanha e confere tudo em tempo real.

## Princípios do desenho

- **Flexível, e não engessado:** o protocolo define as regras, e o restante é gerado a partir dele.
- **Uma única fonte de verdade:** cada informação é digitada uma só vez, no banco de dados.
- **Campo simples:** formulários curtos, botões grandes, poucos toques e uso com uma mão.
- **Segurança no banco:** as regras de acesso valem no Postgres, e não apenas na tela.
- **Rastreabilidade:** nenhum dado de campo é apagado ou alterado sem deixar histórico.
- **Começar pequeno:** um ensaio piloto antes de migrar os demais.

## Fluxo de ponta a ponta

- **Protocolo:** vem da empresa contratante ou é montado pelo Mathaus, e entra no mesmo modelo padrão (identificação, delineamento, tratamentos, avaliações e manejo).
- **Geração automática:** casualização com semente gravada, croqui, mapa de parcelas, cronograma, fichas de avaliação e caderno de campo em PDF.
- **Campo:** coleta por parcela no celular, com foto, data, hora e local automáticos, funcionando offline.
- **Home office:** conferência de qualidade em tempo real (valores fora da faixa, parcelas faltantes, dados sem foto, avaliações atrasadas) e pedidos de correção ao campo.
- **Análise e relatório:** tabelas de médias por tratamento, exportação para o software de estatística e rascunho do relatório técnico. Interpretação e conclusão ficam com o Mathaus.

## Por que Supabase

| Critério | Supabase | Firebase
| Tipo de banco | Relacional (Postgres) | Documentos (NoSQL)
| Ajuste aos dados de ensaio | Muito bom: ensaio, tratamento, bloco e parcela se ligam por tabelas | Exige mais cuidado para relacionar os dados
| Consultas e exportação para estatística | Fácil, com SQL e CSV | Mais trabalhosa
| Funcionamento offline | Precisa ser construído no aplicativo | Pronto no Firestore
| Controle de acesso | Regras por linha (RLS), granulares | Regras por documento
| Histórico e auditoria | Natural, com gatilhos no banco | Exige mais desenvolvimento

Decisão: Supabase, pela estrutura relacional, pela exportação para estatística e pela auditoria. O custo é construir o modo offline no aplicativo, tratado na fase 3.

## Arquitetura

| Camada | Tecnologia | Papel
| Interface | Next.js 16 (App Router) com TypeScript, PWA com Serwist | Telas de campo, home office e coordenação
| Hospedagem | Vercel, plano pago (uso comercial) | Prévias por branch e produção
| Banco e API | Supabase: Postgres, API automática, Realtime | Dados dos ensaios e regras de acesso por linha
| Autenticação | Supabase Auth com login Microsoft (Entra ID, tenant único) | Entrada com a conta da empresa
| Arquivos | Supabase Storage, buckets privados | Fotos, croquis e relatórios em PDF, com links temporários
| Avisos e calendário | pg_cron, pg_net, Edge Functions, feed iCal, Microsoft Graph | Lembretes e agenda de cada pessoa
| Offline no campo | Service worker e IndexedDB, com fila de envio | Coleta sem sinal e sincronização depois
| Ambiente local | Docker (Next.js) e Supabase CLI (supabase start) | Desenvolvimento e testes na máquina de cada pessoa

### Chaves e variáveis de ambiente

- **NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:** públicas, podem ir ao navegador. A chave publicável substitui a antiga chave anon.
- **SUPABASE_SECRET_KEY:** chave secreta, substitui a antiga service_role. Só existe no servidor e em Edge Functions. Nunca vai ao navegador, ao repositório nem à imagem Docker.
- **ALLOWED_EMAIL_DOMAIN:** domínio de e-mail permitido. Lida só no servidor e espelhada em uma configuração do banco. Valor ainda pendente.
- **Arquivos:** .env.example versionado, só com os nomes; .env.local fora do repositório, com os valores. Na Vercel, uma configuração por ambiente (prévia e produção).

## Autenticação e acesso

- **Provedor:** Microsoft (Entra ID) no Supabase Auth, com o aplicativo registrado pela TI como tenant único, ou seja, só contas do diretório da empresa.
- **Barreira no banco:** um Before User Created Hook do Supabase recusa qualquer e-mail fora de ALLOWED_EMAIL_DOMAIN no momento do cadastro.
- **E-mail verificado:** ativar no registro do aplicativo a claim opcional xms_edov e conferir que o e-mail é verificado pelo diretório, como recomenda a documentação do Supabase para o provedor Azure.
- **Sessão:** pacote @supabase/ssr, com sessão em cookies seguros e renovação automática. No Next.js 16, o antigo middleware se chama proxy (arquivo proxy.ts) e bloqueia páginas sem sessão ou sem perfil.
- **Token Bearer:** cada chamada ao Supabase leva o token da sessão. O banco identifica a pessoa por ele, e a RLS decide o que ela lê e grava.
- **Perfil atribuído:** no primeiro login a pessoa entra sem perfil e vê a tela "Aguardando liberação de acesso". Só a coordenação atribui perfil. E-mail da empresa sozinho não dá acesso a dados.
- **Desligamento:** removida do diretório da empresa, a pessoa não renova a sessão; a coordenação também pode revogar o perfil no sistema.

### Perfis e permissões

| Ação | coordination | field | home_office
| Ver ensaios | Todos | Só os atribuídos | Só os atribuídos
| Criar e editar ensaio e protocolo | Sim | Não | Não
| Registrar avaliações, aplicações, ocorrências e fotos | Sim | Sim, nos atribuídos | Não
| Corrigir dado de campo já enviado | Sim, com motivo e histórico | Sim, só os próprios, com motivo e histórico | Não; pede correção ao campo
| Conferir qualidade e marcar como conferido | Sim | Não | Sim
| Gerar tabelas e relatório | Sim | Não | Sim
| Atribuir perfis e ensaios | Sim | Não | Não
| Excluir dado de campo | Não; só anula com motivo | Não | Não
| Alterar ou apagar o histórico | Ninguém | Ninguém | Ninguém

O papel da pessoa fica na tabela profiles e é lido nas políticas por uma função SQL com security definer, para evitar recursão nas políticas da própria tabela profiles.

## Modelo de dados

Tabelas e colunas em inglês, snake_case, chaves uuid, created_at e updated_at. Todas com RLS ligada e negação por padrão. Datas de atividades guardadas com fuso horário (timestamptz) e exibidas no horário de Brasília (America/Sao_Paulo).

| Tabela | Para que serve
| profiles | Pessoa, e-mail e role (coordination, field, home_office ou vazio até a liberação)
| trials | Ensaio: código, contratante, cultura, local, delineamento, datas, status e semente da casualização
| trial_members | Quem está atribuído a cada ensaio; base da regra de visibilidade
| factors e factor_levels | Fatores e níveis para esquema fatorial e parcelas subdivididas
| treatments | Tratamento: número, nome, produto, ingrediente ativo, dose, formulação, época, e os níveis de fator que o compõem
| plots | Parcela: número, bloco, tratamento sorteado, coordenadas no croqui, e parcela principal no caso de subdivididas
| assessment_variables | Variável de avaliação: nome, unidade, método, escala, valor mínimo e máximo para validação
| planned_assessments | Avaliação prevista: variável, momento (dias após plantio ou aplicação), data calculada e responsável
| field_records | Valor por parcela e avaliação, autor, data e hora, local, observação, id gerado no celular e status (válido ou anulado com motivo)
| field_record_photos | Fotos de cada registro: caminho no Storage privado, data, hora e local
| applications | Aplicação: equipamento, volume de calda, temperatura, umidade, vento, operador, horário
| occurrences | Ocorrência: data, parcela opcional, descrição e fotos
| quality_flags | Alertas da conferência, situação (aberto, conferido, correção pedida) e quem tratou
| change_history | Histórico de alterações: tabela, registro, autor, data, valor anterior e valor novo; só aceita inclusão
| notification_preferences | Canais e antecedência dos avisos por pessoa
| notification_log | Avisos enviados, para nunca repetir
| push_subscriptions | Inscrições de push de cada aparelho
| calendar_feed_tokens | Token secreto do feed iCal de cada pessoa, revogável

## Coleta de campo offline

- **Aplicativo instalável (PWA):** service worker com Serwist; as telas de coleta são componentes de cliente e ficam em cache para abrir sem sinal.
- **Fila local:** cada registro é salvo primeiro no IndexedDB, com um id gerado no celular. O envio usa esse id para que reenviar nunca duplique o registro.
- **Só apaga da fila depois da confirmação do servidor.** Nenhum dado coletado pode se perder.
- **Sessão expirada:** a sessão dura cerca de uma hora e renovar exige internet. Ao voltar o sinal, o app renova a sessão primeiro e depois envia a fila. Coletar offline nunca depende de a sessão estar válida.
- **iPhone:** o Safari não faz sincronização em segundo plano. A fila só é enviada com o app aberto, e o app mostra um aviso claro de registros pendentes. No Android, a sincronização em segundo plano é usada quando disponível.
- **Espaço no aparelho:** fotos são comprimidas antes de entrar na fila. O app pede armazenamento persistente ao navegador e mostra o espaço usado.
- **Conflitos:** se o mesmo registro foi alterado em dois lugares, as duas versões vão para o histórico e um alerta é aberto para a conferência.
- **Validações na hora:** valor fora da faixa da variável, parcela repetida e avaliação já preenchida.

## Avisos e calendário

| Canal | Situação | Observação
| Push no celular | Recomendado | No iPhone, só funciona com o app instalado na tela inicial (iOS 16.4 ou mais novo)
| E-mail | Recomendado | Bom para o home office e para registro
| Calendário (Outlook) | Recomendado | Começa pelo feed iCal e evolui para o Microsoft Graph
| WhatsApp | Adiado | API oficial exige modelos aprovados; opções não oficiais arriscam bloqueio do número

- **Agendador:** pg_cron com pg_net chama a cada poucos minutos uma Edge Function de avisos. URL e chaves ficam no Vault do Supabase.
- **Fuso horário:** o pg_cron roda em UTC. A função calcula as datas no horário de Brasília antes de decidir o que avisar.
- **Envio:** push (Web Push com VAPID) e e-mail, conforme as preferências da pessoa, com registro em notification_log para não repetir.
- **Feed iCal:** link privado por pessoa, com token secreto revogável. Leva só atividade, ensaio, parcela e horário, sem dados sensíveis. O Outlook atualiza assinaturas externas a cada algumas horas, então a agenda não é instantânea.
- **Microsoft Graph (evolução):** recomendado usar permissão de aplicativo (Calendars.ReadWrite) com consentimento da TI, restrita ao grupo da equipe pelo controle de acesso a aplicativos do Exchange Online. Assim o sistema cria, altera e cancela eventos sem guardar tokens de cada pessoa. A alternativa por usuário exige capturar e guardar o token de renovação do Microsoft no login, o que o Supabase não faz sozinho.

## Ambientes e banco de dados

| Ambiente | Banco | Uso
| Local | Supabase local (supabase start, no Docker) | Desenvolvimento, migrations e testes de acesso; dados fictícios
| Teste (staging) | Projeto de teste no Supabase | Prévias da Vercel e validação pelo Mathaus e pela equipe do piloto
| Produção | Projeto de produção no Supabase, plano pago | Ensaios reais

- **Migrations são a única forma de mudar o banco:** supabase/migrations, versionadas no repositório. Nada é alterado só pelo painel.
- **Protótipo do Lovable:** usa dados fictícios e não cria tabelas. Serve de referência visual e de fonte de componentes para o Next.js.
- **Login local:** o provedor Microsoft é configurado no supabase/config.toml, e a TI cadastra no registro do aplicativo o endereço de retorno do ambiente local e do de teste.
- **Docker:** Dockerfile em etapas (dependências, desenvolvimento, build, imagem final sem privilégio de administrador), saída standalone no next.config e docker compose com perfis dev e prod.
- **Pronto quando:** um desenvolvedor novo clona o projeto, preenche o .env.local e abre o sistema no navegador em menos de 15 minutos.

## Cronograma (cerca de 20 semanas)

Cada fase termina com uma entrega que a equipe consegue testar. O prazo é uma estimativa a ajustar com quem for desenvolver.

| Fase | Semanas | Entrega principal | Responsável
| 0. Alinhamento | 1 e 2 | Protocolo padrão aprovado, piloto escolhido, pedidos à TI, protótipo do Lovable | Mathaus
| 1. Base, login e ambientes | 3 a 6 | Next.js com as telas do protótipo, Docker, migrations, RLS, login Microsoft, perfis, histórico | Desenvolvedor
| 2. Geração automática | 7 a 9 | Casualização, croqui, cronograma, fichas e caderno de campo em PDF | Desenvolvedor, com validação do Mathaus
| 3. Coleta de campo | 10 a 12 | Coleta offline no celular, fotos, validações, aplicações e ocorrências | Desenvolvedor e equipe de campo
| 4. Avisos e calendário | 13 e 14 | Push, e-mail, feed iCal e, se liberado, Microsoft Graph | Desenvolvedor e TI
| 5. Painel e relatório | 15 a 17 | Painel em tempo real, conferência de qualidade, médias e rascunho do relatório | Desenvolvedor e home office
| 6. Endurecimento | 18 a 20 | Testes de acesso por perfil, backup e restauração, monitoramento, treinamento | Desenvolvedor

A fase 1 ganhou uma semana a mais que na versão anterior, porque junta a migração das telas do Lovable para o Next.js com banco, login, perfis e Docker.

### Fase 0: Alinhamento (semanas 1 e 2)

- Fechar o modelo de protocolo padrão e listar os delineamentos e as variáveis mais usados, com unidade e faixa de valores.
- Escolher o ensaio piloto: pequeno, com poucas parcelas e uma equipe de campo disposta a testar.
- Pedir à TI: registro do aplicativo no Entra ID (tenant único), endereços de retorno, domínio de e-mail permitido e, em paralelo, a permissão de calendário para o Microsoft Graph.
- Levantar os aparelhos da equipe de campo (Android ou iPhone) e o sinal nas áreas de ensaio.
- Verificar se algum contratante exige BPL ou BPA no caderno de campo e no histórico.
- Gerar o protótipo da interface no Lovable, com dados fictícios.
- Pronto quando: modelo de protocolo aprovado, piloto escolhido e pedidos à TI enviados.

### Fase 1: Base, login e ambientes (semanas 3 a 6)

- Projeto Next.js 16 na Vercel, com as telas do protótipo migradas e a camada de acesso a dados em src/lib/data.
- Docker e Supabase local funcionando com um comando.
- Migrations com todas as tabelas, RLS por perfil e atribuição de ensaios, gatilhos de histórico e anulação no lugar de exclusão.
- Login Microsoft restrito ao domínio, hook de domínio no banco, tela de aguardando liberação e administração de perfis.
- Testes de acesso por perfil no banco (pgTAP, com supabase test db).
- Projeto de teste e de produção separados; backup ativo em produção.
- Pronto quando: um ensaio de teste é cadastrado, cada perfil vê só o que deve, e um dev novo sobe o sistema em menos de 15 minutos.

### Fase 2: Geração automática (semanas 7 a 9)

- Cadastro do protocolo a partir do modelo padrão, vindo da empresa ou montado pelo Mathaus.
- Casualização reproduzível, com semente gravada: DBC e DIC primeiro, depois fatorial e parcelas subdivididas.
- Croqui e mapa de parcelas, cronograma calculado a partir da data de plantio ou da primeira aplicação, fichas de avaliação e caderno de campo em PDF.
- Pronto quando: o protocolo do piloto gera todos os documentos sem edição manual e o Mathaus aprova.

### Fase 3: Coleta de campo (semanas 10 a 12)

- Telas de coleta no celular, fila offline com id gerado no aparelho, renovação de sessão antes do envio e tratamento de conflitos.
- Fotos comprimidas e enviadas ao Storage privado; validações na hora; registro de aplicações e ocorrências.
- Teste real sem sinal, em área de ensaio, com os aparelhos da equipe (incluindo iPhone, se houver).
- Pronto quando: uma avaliação completa do piloto coletada sem sinal chega ao banco sem perda nem duplicação.

### Fase 4: Avisos e calendário (semanas 13 e 14)

- pg_cron chamando a Edge Function de avisos, com push, e-mail, preferências por pessoa e registro de envio.
- Feed iCal por pessoa, com token revogável.
- Microsoft Graph, se a TI tiver liberado.
- Pronto quando: uma avaliação marcada aparece na agenda e chega como aviso ao responsável certo, no horário de Brasília.

### Fase 5: Painel e relatório (semanas 15 a 17)

- Painel em tempo real com avaliações feitas, pendentes e atrasadas, por ensaio e por pessoa.
- Conferência de qualidade com alertas, "marcar como conferido" e "pedir correção ao campo".
- Tabelas de médias por tratamento e exportação em CSV. Análise estatística inferencial só depois de o Mathaus confirmar método e software.
- Modelo de relatório com seções fixas, com interpretação e conclusão em branco para o Mathaus.
- Pronto quando: o relatório do piloto sai com métodos e resultados pré-preenchidos.

### Fase 6: Endurecimento (semanas 18 a 20)

- Testes de acesso por perfil rodando no Docker antes de cada publicação.
- Teste de restauração de backup.
- Monitoramento de erros e registro de acessos.
- Treinamento curto da equipe de campo e do home office, com guia de uma página.
- Pronto quando: restauração testada, testes automáticos passando e equipe do piloto treinada.

## Segurança, conformidade e LGPD

- **Backup:** automático em produção, com teste de restauração antes de usar o sistema em ensaio real. Pede plano pago do Supabase.
- **Histórico imutável:** change_history só aceita inclusão. Nem a coordenação altera ou apaga. Registros de campo não são excluídos; são anulados com motivo.
- **BPL/BPA:** se algum contratante exigir, validar na fase 0 o formato do caderno de campo, a identificação de quem registrou e a retenção dos dados.
- **LGPD:** o sistema guarda dados de funcionários (nome, e-mail, acessos) e fotos com localização. Registrar a finalidade, limitar o acesso por perfil, definir por quanto tempo os dados ficam guardados e não colocar dados pessoais no feed iCal.
- **Arquivos privados:** fotos e relatórios em buckets privados, com links temporários.
- **Revisão de acessos:** registro de acessos e revisão periódica de quem tem cada perfil.
- **Hospedagem:** plano pago na Vercel, por ser uso comercial.

## Riscos e como reduzir

| Risco | Efeito | Como reduzir
| Autorização da TI demorar | Login atrasa; calendário fica só no feed iCal | Pedir na semana 1; o feed iCal não depende da TI
| Falta de sinal no campo | Perda ou atraso de dados | Offline desde a primeira versão; teste em área real
| Equipe de campo com iPhone | Fila só sincroniza com o app aberto; push só com app instalado | Aviso visível de pendências; instalar o app no treinamento
| Sessão expirada no campo | Envio falha ao voltar o sinal | Renovar a sessão antes de enviar; coleta não depende da sessão
| Migração do Lovable para o Next.js | Fase 1 atrasa | Fase com 4 semanas; protótipo como referência, não como código final
| Equipe resistir à mudança | Uso pela metade e dados duplicados | Piloto com voluntários, treinamento curto, papel só como contingência
| Protocolos muito variados | Modelo padrão não cobre tudo | Começar por DBC e DIC; fatorial e subdivididas depois
| Exigência de auditoria | Retrabalho no caderno de campo | Histórico imutável e validação do formato na fase 0
| Dependência de uma só pessoa no desenvolvimento | Atrasos | Documentação desde o início e código em repositório da empresa

## Equipe

- **Mathaus:** dono do modelo de protocolo e validador de cada entrega.
- **Desenvolvedor parceiro:** banco, aplicativo, avisos e integrações.
- **TI da empresa:** registro do aplicativo, domínio e permissões do Microsoft 365.
- **Equipe de campo e home office:** testes do piloto e retorno semanal.

## Pendências e decisões em aberto

- Domínio de e-mail da empresa.
- Autorização da TI para o registro no Entra ID e, depois, para o Microsoft Graph.
- Quem desenvolve, em que horas, e o orçamento de Vercel e Supabase em plano pago.
- Nome e escopo do ensaio piloto, e a data de início.
- Delineamentos mais usados (DBC, DIC, fatorial, parcelas subdivididas).
- Quantos ensaios rodam ao mesmo tempo e com quantas pessoas no campo.
- Aparelhos da equipe de campo (Android ou iPhone) e sinal nas áreas de ensaio.
- Exigências de BPL ou BPA dos contratantes.
- Software de estatística usado hoje.
- Confirmar a regra do perfil home office: só conferir e pedir correção, sem editar dado de campo.

## Depois do piloto

- Rodar o segundo e o terceiro ensaio já no sistema, coletando ajustes da equipe.
- Migrar os ensaios em andamento aos poucos, sem trocar de sistema no meio de um ensaio.
- Reavaliar WhatsApp e melhorias como mapas de calor por parcela e importação de dados de equipamentos.
