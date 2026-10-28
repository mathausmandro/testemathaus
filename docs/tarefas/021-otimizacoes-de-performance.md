# 021 - Otimizações de performance apontadas na revisão final
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: sonnet (políticas RLS: opus)

## Objetivo
Aplicar as recomendações de docs/performance/003-019.md antes de usar o sistema com volume real de dados.

## Escopo
- Políticas de SELECT: trocar `has_trial_access(trial_id)` por `(select has_trial_access(trial_id))` ou equivalente que evite chamada por linha, em migration nova, com pgTAP da matriz 010 passando.
- Paginação em listTrials e listPlots.
- Reduzir idas ao Supabase por tela logada (proxy e página repetem getClaims/getUser e leitura de profiles): reaproveitar o resultado por requisição.
- Paralelizar as consultas em série de /ensaios/[id] e /admin/ensaios/[id].
- Medir o JS real das rotas logadas (Lighthouse autenticado) e manter abaixo de 200 KB; formulários de /admin/*/[id] e /ensaios/novo estimados em 206 a 207 KB.

## Critérios de aceite
- [ ] EXPLAIN ANALYZE das consultas da tela de coleta e da lista de ensaios até 200 ms com 5 mil registros (comandos na seção 5 de docs/performance/003-019.md).
- [ ] Matriz de acesso pgTAP (010) sem regressão.
- [ ] Lighthouse autenticado das telas de campo com performance >= 0,85 e JS inicial <= 200 KB.

## Dependências
Requer Docker/Supabase local (validação na máquina do parceiro).

## Entrega (preenchido pelo desenvolvedor)
