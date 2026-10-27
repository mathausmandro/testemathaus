# 010 - Testes pgTAP: matriz de acesso completa por perfil
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Consolidar uma suíte pgTAP transversal que prove, para todas as tabelas, quem pode ler e gravar o quê, e fechar lacunas das tarefas 005 a 009, funcionando como porta de segurança do pipeline.

## Escopo
Inclui:
- Helpers de teste reutilizáveis (simular usuário por perfil via claims JWT, criar usuários e ensaios fictícios).
- Teste automático que lista todas as tabelas do schema public e falha se alguma não tiver RLS ligada (garante que tabelas futuras entrem na regra).
- Teste que falha se existir política com using (true) / with check (true) em tabela de dados.
- Matriz completa para os quatro tipos de usuário (coordination, field, home_office, sem perfil) e para ensaio atribuído e não atribuído, em todas as tabelas, com SELECT, INSERT, UPDATE e DELETE.
- Testes de vazamento entre ensaios (dois ensaios, usuário só em um).
- Teste de que funções security definer têm search_path fixo.
- Documentação da matriz esperada em docs/seguranca/matriz-acesso.md (tabela perfil x tabela x operação).

Não inclui: testes de interface, novos recursos de banco.

## Arquivos afetados
supabase/tests/*, docs/seguranca/matriz-acesso.md, pipeline (002) se necessário.

## Critérios de aceite
- [ ] supabase test db passa e é executado na etapa pgTAP do npm run verify e no CI.
- [ ] Criar uma tabela de teste sem RLS faz a suíte falhar (verificado e revertido).
- [ ] Criar uma política using (true) faz a suíte falhar (verificado e revertido).
- [ ] A matriz documentada coincide com os testes (cada célula da matriz tem pelo menos um teste).
- [ ] Todas as tentativas proibidas por perfil falham e todas as permitidas funcionam.
- [ ] Nenhum teste usa a chave secreta para contornar política.

## Testes esperados
pgTAP: toda a tarefa. Unitários: não se aplica. e2e: não se aplica. Performance: tempo da suíte registrado. Segurança: esta tarefa é a evidência para o relatório do papel seguranca.

## Riscos e dependências
- Depende de 005 a 009. Risco: testes frágeis dependentes de seed; usar fixtures criadas dentro de cada teste.

## Dúvidas para o Mathaus
- Confirmar a matriz de permissões do plano (a regra do home_office é a única marcada como pendente).

## Entrega (preenchido pelo desenvolvedor)
