# 020 - Migração das telas do protótipo do Lovable para o Next.js
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: sonnet

## Objetivo
Trazer o visual e os componentes do protótipo do Lovable (React com Vite, dados fictícios) para o Next.js 16, substituindo as telas mínimas das tarefas 014 a 016 sem alterar regras de acesso nem a camada de dados.

## Escopo
Inclui:
- Inventário das telas e componentes do protótipo, mapeado para as rotas do App Router (src/app/(auth) e src/app/(app)).
- Portar componentes como Server Components por padrão; "use client" apenas onde interativo; sem bibliotecas pesadas no bundle inicial; carregar gráficos e PDF com import dinâmico.
- Trocar dados fictícios por chamadas a src/lib/data; nenhum acesso direto ao Supabase nas telas; nada do protótipo cria tabelas.
- Manter todos os testes e2e, de acessibilidade e de performance verdes; ajustar seletores quando necessário.
- Telas de campo prioritárias para uso com uma mão (botões grandes, poucos toques).
- Registro em docs/ do que do protótipo foi adotado, adaptado ou descartado.

Não inclui: novas funcionalidades, telas das Fases 2 a 5 (migrar apenas as que a Fase 1 já cobre; as demais ficam para cada fase), mudança de regras de acesso.

## Arquivos afetados
src/app/*, src/components/*, estilos Tailwind, tests/e2e/*, tests/perf/*, docs/prototipo.md.

## Critérios de aceite
- [ ] Todas as telas da Fase 1 do protótipo existem no Next.js e usam dados reais via src/lib/data.
- [ ] npm run verify passa, incluindo e2e por perfil, Lighthouse e test:security, sem reduzir os limiares.
- [ ] Nenhuma dependência do protótipo é adicionada sem justificativa; tamanho do bundle inicial medido antes e depois.
- [ ] Textos em português do Brasil; datas exibidas em America/Sao_Paulo.
- [ ] Nenhuma tela do protótipo expõe, por baixo, dado de ensaio sem passar por RLS.
- [ ] Revisão visual e aprovação do Mathaus nas telas migradas.

## Testes esperados
Unitários: componentes portados com Testing Library. e2e: os fluxos por perfil existentes continuam passando. pgTAP: não se altera. Performance: Lighthouse e tamanho do bundle comparados. Segurança: test:security passa; sem segredos nem dados fictícios com aparência de reais.

## Riscos e dependências
- Depende do protótipo do Lovable (Fase 0, ainda inexistente) e das tarefas 014, 016 e 017. As demais tarefas não dependem desta; ela pode ser feita a qualquer momento depois que o protótipo existir, inclusive após o fim da Fase 1.
- Risco: o protótipo ter muitas dependências ou estilos incompatíveis; tratar como referência, não como código final.

## Dúvidas para o Mathaus
- Quando o protótipo do Lovable estará disponível e onde fica o código exportado?
- Quais telas do protótipo são prioritárias para o piloto?

## Entrega (preenchido pelo desenvolvedor)
