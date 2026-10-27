# 016 - Cadastro e visualização do ensaio de teste (telas mínimas)
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: sonnet

## Objetivo
Entregar o critério de pronto da Fase 1: cadastrar um ensaio de teste e provar na interface que cada perfil vê só o que deve, usando telas mínimas próprias, sem depender do protótipo do Lovable.

## Escopo
Inclui:
- Lista de ensaios (src/app/(app)/ensaios) mostrando só os que a pessoa pode ver, via src/lib/data.
- Formulário de criação de ensaio (só coordination) com validação zod no servidor: código, contratante, cultura, local, delineamento, datas previstas, responsável técnico.
- Página de detalhe do ensaio: identificação, membros atribuídos (somente leitura aqui; edição fica na 015) e, em modo leitura, a lista de tratamentos e parcelas do seed.
- Estados de carregamento, erro e vazio, em português do Brasil, acessíveis (rótulos, foco, contraste) e com layout responsivo para celular.
- Seed fictício de dois ensaios e usuários dos três perfis para demonstração local.
- Fluxo e2e por perfil.

Não inclui: cadastro completo do protocolo, casualização, croqui, cronograma (Fase 2), telas de coleta (Fase 3), visual final do protótipo (tarefa 020).

## Arquivos afetados
src/app/(app)/ensaios/*, src/components/*, src/lib/data/trials.ts, supabase/seed.sql, tests/e2e/*, tests/perf/*.

## Critérios de aceite
- [ ] coordination cria um ensaio de teste e ele aparece na lista.
- [ ] field e home_office atribuídos veem apenas os ensaios atribuídos; o ensaio não atribuído não aparece e a URL direta dele devolve não encontrado/negado.
- [ ] field e home_office não veem o botão de criar e, chamando a ação diretamente, são rejeitados.
- [ ] Usuário sem perfil não chega às páginas de ensaios (tarefa 014).
- [ ] Entradas inválidas (código vazio, datas incoerentes) mostram erro claro e não gravam.
- [ ] Layout utilizável em tela de celular e passa nos limiares de acessibilidade do Lighthouse definidos em 002.
- [ ] Nenhuma chamada ao Supabase fora de src/lib/data.

## Testes esperados
Unitários: formulário e validações. e2e: um fluxo por perfil (coordination, field, home_office, sem perfil). pgTAP: coberto em 005 a 010. Performance: Lighthouse nas telas de lista e detalhe. Segurança: acesso por URL direta (IDOR) a ensaio de outro, XSS em campos de texto.

## Riscos e dependências
- Depende de 006, 011, 014 e, para a atribuição de membros, de 015 (pode seguir em paralelo usando o seed).
- Não inventar regras agronômicas: campos e opções do delineamento seguem o plano; valores adicionais dependem das respostas do Mathaus.

## Dúvidas para o Mathaus
- Os campos do cadastro do ensaio estão completos para o piloto?
- Código do ensaio: há padrão de numeração (ex.: ano, sequência) que o sistema deve sugerir ou validar?

## Entrega (preenchido pelo desenvolvedor)
