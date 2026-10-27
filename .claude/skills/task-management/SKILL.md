---
name: task-management
description: Use ao planejar, quebrar, acompanhar ou fechar tarefas do projeto, e ao orquestrar os papéis analista, desenvolvedor, qa, performance e seguranca.
---

## Arquivos
- docs/tarefas/INDICE.md: tabela com número, nome, fase, status, modelo do desenvolvedor e links dos relatórios.
- docs/tarefas/NNN-nome.md: uma tarefa por arquivo, numeradas em sequência (001, 002...).
- docs/qa/NNN.md, docs/performance/NNN.md, docs/seguranca/NNN.md: relatórios de cada papel.

## Modelo de tarefa
```
# NNN - Nome
Fase: N | Status: a fazer | Modelo do desenvolvedor: sonnet ou opus
## Objetivo
## Escopo
Inclui: ...
Não inclui: ...
## Arquivos afetados
## Critérios de aceite
- [ ] verificável 1
## Testes esperados
Unitários, e2e, pgTAP, performance, segurança
## Riscos e dependências
## Dúvidas para o Mathaus
## Entrega (preenchido pelo desenvolvedor)
```

## Status
a fazer, em análise, em desenvolvimento, em QA, em performance, em segurança, devolvida, pronta.

## Orquestração
1. analista (sonnet) cria ou refina a tarefa.
2. desenvolvedor (sonnet; opus para RLS, autenticação e offline) implementa.
3. qa (haiku; sonnet se precisar escrever muitos testes) verifica.
4. performance (sonnet) mede.
5. seguranca (opus) revisa.
6. Qualquer REPROVADO devolve ao desenvolvedor com o relatório. Só fica pronta com os três aprovados.
7. Cada papel roda como subagente separado e recebe apenas o caminho da tarefa e dos relatórios, nunca o histórico de outro papel.
8. Ao fechar, atualize INDICE.md e a seção Status de docs/PLANO.md.

## Escolha de modelo
- haiku: rodar comandos, conferir listas, relatórios simples.
- sonnet: análise, código comum, testes, performance.
- opus: segurança, RLS, autenticação, sincronização offline e decisões de arquitetura.
