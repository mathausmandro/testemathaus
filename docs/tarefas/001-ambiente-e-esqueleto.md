# 001 - Preparação do ambiente e esqueleto do projeto
Fase: 1 | Status: em QA | Modelo do desenvolvedor: sonnet

## Objetivo
Deixar a máquina pronta para desenvolver (Node.js, Git, Docker Desktop, Supabase CLI) e criar o esqueleto do projeto Next.js 16 com as ferramentas de teste instaladas e os scripts npm padronizados, para que todas as tarefas seguintes partam de uma base que roda.

## Escopo
Inclui:
- Instalar e conferir versões: Node.js LTS, Git, Docker Desktop, Supabase CLI. Registrar as versões usadas em docs/ambiente.md.
- git init, primeiro commit, .gitignore (inclui .env*, exceto .env.example, node_modules, .next, coverage, test-results, playwright-report, .lighthouseci, supabase/.temp).
- create-next-app com Next.js 16, TypeScript, ESLint, Tailwind, pasta src/ e App Router.
- Estrutura de pastas do AGENTS.md (src/lib/data, src/lib/design, src/lib/offline, src/components, supabase/migrations, supabase/tests, tests/e2e, tests/perf, tests/security) com arquivos .gitkeep onde vazias.
- Scripts npm: lint, typecheck, test, test:e2e, test:perf, test:security (cada um funcional, mesmo que com um teste de fumaça).
- Vitest + Testing Library (um teste de fumaça), Playwright (um teste e2e de fumaça abrindo a página inicial), Lighthouse CI (configuração base lighthouserc), gitleaks (configuração base .gitleaks.toml e script de varredura).
- .env.example com os nomes: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, ALLOWED_EMAIL_DOMAIN (sem valores reais).
- Página inicial mínima em português do Brasil.

Não inclui: Docker do app (tarefa 003), pipeline de CI (002), Supabase local (004), qualquer tela de negócio, repositório remoto (depende de decisão do Mathaus).

## Arquivos afetados
package.json, tsconfig.json, eslint config, next.config.ts, tailwind config, vitest.config.ts, playwright.config.ts, lighthouserc.json, .gitleaks.toml, .gitignore, .env.example, src/app/*, tests/*, docs/ambiente.md.

## Critérios de aceite
- [ ] node -v, git --version, docker --version e supabase --version respondem; versões registradas em docs/ambiente.md.
- [ ] npm ci seguido de npm run build termina sem erro.
- [ ] npm run lint, typecheck, test, test:e2e, test:perf e test:security existem e passam no esqueleto.
- [ ] A varredura de gitleaks passa e falha de propósito quando um segredo falso é colocado em arquivo de teste (verificado e depois removido).
- [ ] .env.local e qualquer .env com valores estão no .gitignore; .env.example só tem nomes.
- [ ] Nenhuma variável NEXT_PUBLIC contém segredo; SUPABASE_SECRET_KEY não tem prefixo NEXT_PUBLIC.
- [ ] Repositório git inicializado com pelo menos um commit limpo.
- [ ] Versão do Next.js instalada é 16.x (conferida em package.json).
- [ ] Acesso por perfil: não se aplica (sem dados); registrado no relatório.

## Testes esperados
Unitários: um teste de fumaça (Vitest). e2e: abre a página inicial (Playwright). pgTAP: não se aplica. Performance: Lighthouse CI roda sobre a página inicial e gera relatório. Segurança: gitleaks e npm audit executam.

## Riscos e dependências
- Instalação de Docker Desktop e WSL2 pode exigir reinicialização e virtualização ligada na BIOS; instalação de software é feita pelo Mathaus ou com sua autorização explícita.
- create-next-app pode trazer versões diferentes das esperadas; conferir que é a 16.
- Dependências: nenhuma.

## Dúvidas para o Mathaus
- Onde ficará o repositório remoto (GitHub da empresa? conta pessoal?) e quem terá acesso.
- Há restrição da TI para instalar Docker Desktop (licença) nesta máquina?

## Entrega (preenchido pelo desenvolvedor)
### Arquivos criados
package.json e package-lock.json, tsconfig.json, eslint.config.mjs, next.config.ts (cabeçalhos X-Content-Type-Options, Referrer-Policy e Permissions-Policy; CSP fica para tarefa de segurança), vitest.config.mts, vitest.setup.ts, playwright.config.ts, lighthouserc.json, .gitleaks.toml, .secretlintrc.json, .secretlintignore, .gitignore, .env.example (só nomes), src/app (layout, page, globals.css, favicon), tests/unit/home.test.tsx, tests/e2e/home.spec.ts, tests/perf/run-lighthouse.mjs, .gitkeep nas pastas vazias (src/lib/data, design, offline, src/components, supabase/migrations, supabase/tests, tests/perf, tests/security, public), docs/ambiente.md. CLAUDE.md, AGENTS.md, docs/ e .claude/ não foram alterados (exceto esta tarefa).

### Como testar
npm ci; npx playwright install chromium; depois: npm run lint, npm run typecheck, npm test, npm run test:e2e, npm run test:perf, npm run test:security. Variáveis em .env.example; copiar para .env.local.

### Resultado dos scripts (rodados nesta entrega)
- lint: passa. typecheck: passa. test (Vitest, 1 teste): passa.
- test:e2e (build + Playwright chromium, 1 teste): passa.
- test:perf (build, servidor na porta 3200, Lighthouse CI sobre "/", upload filesystem em .lighthouseci): passa. Notas do relatório: desempenho 0,92, acessibilidade 1, boas práticas 1, SEO 1.
- test:security (secretlint + npm audit --audit-level=high): passa, 0 vulnerabilidades.
- Segredo falso: arquivo de teste com token no formato GitHub foi detectado pelo secretlint (GITHUB_TOKEN, saída com erro) e depois removido. Observação: a chave de exemplo oficial da AWS (AKIAIOSFODNN7EXAMPLE) é ignorada pelo secretlint de propósito, por isso não serve como segredo falso.
- Versão do Next.js: 16.4.3. Versões completas em docs/ambiente.md.

### Desvios e decisões (para o QA e o Mathaus conferirem)
1. gitleaks trocado por secretlint na varredura local (binário sem autorização de instalação). .gitleaks.toml está pronto para o CI da tarefa 002, que pode adotar gitleaks.
2. @lhci/cli não está em devDependencies: suas dependências transitivas (lighthouse, puppeteer-core, extract-zip, tmp, basic-ftp) geravam 13 avisos de severidade alta no npm audit, sem correção disponível, o que quebraria o test:security. O test:perf executa `npx @lhci/cli@0.15.1` (versão fixa) fora da árvore auditada. Reavaliar quando houver versão corrigida.
3. test:perf usa o chrome-headless-shell do Playwright via CHROME_PATH. O chrome.exe do Playwright falhou nesta máquina ("configuração lado a lado incorreta", problema do Windows local, não do projeto).
4. test:e2e executa `npm run build` antes do Playwright (o build leva cerca de 2 minutos nesta máquina); o servidor de teste é `next start` na porta 3100.
5. @types/node foi para ^24 (exigência de peer do Vitest 5). Fontes do Google removidas do layout (fonte do sistema), para o build não depender de rede.
6. Houve falta de espaço em disco (ENOSPC) durante a instalação; o cache do npm foi limpo. Recomendado manter 2 GB livres.
7. O create-next-app 16.4.3 gerou next.config.ts com cacheComponents e partialPrefetching ligados; foram mantidos como gerados.

### Pendências
- Docker Desktop: não instalado, depende da TI (critério "docker --version" fica pendente; registrado em docs/ambiente.md).
- Repositório remoto: depende de decisão do Mathaus (dúvida da tarefa continua aberta).
- Domínio de e-mail permitido: ALLOWED_EMAIL_DOMAIN fica vazio.
