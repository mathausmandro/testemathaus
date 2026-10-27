# 017 - Cabeçalhos de segurança, validação de entrada e suíte test:security
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Aplicar a configuração de segurança HTTP do app e montar a suíte tests/security executada por npm run test:security, cobrindo cabeçalhos, segredos, rotas protegidas e dependências.

## Escopo
Inclui:
- Cabeçalhos em next.config: Content-Security-Policy (compatível com Next.js, Supabase local e de teste e produção, sem unsafe-inline desnecessário), X-Content-Type-Options, Referrer-Policy, Permissions-Policy (câmera e localização apenas no próprio site), HSTS (efetivo fora do local), frame-ancestors/X-Frame-Options.
- Utilitário compartilhado de validação zod para Server Actions (padrão de erro uniforme, sem vazar detalhes internos).
- Suíte tests/security: verifica cabeçalhos em páginas públicas e logadas; varre o bundle do cliente e o repositório em busca de SUPABASE_SECRET_KEY e outros segredos; confirma que todas as rotas de src/app/(app) e src/app/api exigem sessão; confirma .env* no .gitignore; roda npm audit e gitleaks.
- Documento docs/seguranca/base.md com a política de cabeçalhos e como ajustar o CSP ao adicionar domínios (ex.: Storage).

Não inclui: rate limiting avançado, WAF, revisão formal (papel seguranca), cabeçalhos específicos de upload de fotos (Fase 3).

## Arquivos afetados
next.config.ts, src/lib/validation/*, tests/security/*, package.json, docs/seguranca/base.md, pipeline (002).

## Critérios de aceite
- [ ] Resposta de páginas públicas e logadas inclui todos os cabeçalhos definidos (teste automatizado).
- [ ] O app (login, lista de ensaios) funciona normalmente com o CSP ativo, sem erros de CSP no console (e2e).
- [ ] npm run test:security passa no estado atual e falha quando: um cabeçalho é removido, um segredo falso é adicionado, uma rota logada sai da proteção ou existe dependência alta/crítica (cada caso verificado e revertido).
- [ ] test:security roda no npm run verify e no CI.
- [ ] Entradas inválidas em Server Actions retornam erro padronizado em português, sem stack trace.
- [ ] Acesso por perfil: o teste de rotas confirma resposta negada para cada perfil em rotas que não lhe pertencem.

## Testes esperados
Unitários: utilitário de validação. e2e: sem erros de CSP nas telas existentes. pgTAP: não se aplica. Performance: impacto dos cabeçalhos nulo; Lighthouse boas práticas. Segurança: toda a tarefa.

## Riscos e dependências
- Depende de 001, 002 e, para varrer rotas reais, de 014. Pode começar cedo e ser completada após 016.
- Risco: CSP muito estrito quebra Next.js/Serwist em fases futuras; documentar como evoluir.

## Dúvidas para o Mathaus
- Nenhuma. Os domínios definitivos (Vercel e Supabase) serão necessários na tarefa 018 para fechar o CSP de produção.

## Entrega (preenchido pelo desenvolvedor)
