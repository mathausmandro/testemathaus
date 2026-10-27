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
