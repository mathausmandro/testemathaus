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
