# Ambiente de desenvolvimento

Registro das versões usadas na tarefa 001 (máquina Windows 11, PowerShell 5.1).

## Ferramentas instaladas na máquina

| Ferramenta | Versão | Situação |
| --- | --- | --- |
| Node.js | 24.22.1 (LTS 24) | instalado |
| npm | 11.19.1 | instalado com o Node.js |
| Git | 2.56.0 (Git for Windows) | instalado |
| Docker Desktop | pendente | não instalado de propósito; depende da TI (licença, WSL2, virtualização). Necessário a partir da tarefa 003 |
| Supabase CLI | 2.122.0 | devDependency npm "supabase"; conferir com `npx supabase --version` |

## Dependências principais do projeto

| Pacote | Versão |
| --- | --- |
| Next.js | 16.4.3 (App Router, Turbopack) |
| React / React DOM | 19.3.0 |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |
| ESLint | ^9 (eslint-config-next 16.4.3) |
| Vitest | ^5.0.5 (jsdom, Testing Library) |
| Playwright | ^1.64.1 (somente Chromium) |
| Lighthouse CI (@lhci/cli) | 0.15.1, executado por `npx` fixado no script test:perf |
| secretlint | ^13.1.0 (preset recommend) |

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes unitários (Vitest) |
| `npm run test:e2e` | build e testes de ponta a ponta (Playwright, Chromium) na porta 3100 |
| `npm run test:perf` | build, sobe o servidor na porta 3200 e roda Lighthouse CI sobre a página inicial; relatórios em `.lighthouseci` (upload filesystem, nada sai da máquina) |
| `npm run test:security` | secretlint (varredura de segredos) e `npm audit --audit-level=high` |

## Preparar uma máquina nova

1. Instalar Node.js LTS 24 e Git.
2. `npm ci`
3. `npx playwright install chromium`
4. Copiar `.env.example` para `.env.local` e preencher (nunca versionar).

## Decisões e observações

- gitleaks é binário e não foi instalado. Localmente a varredura de segredos usa secretlint. O arquivo `.gitleaks.toml` está pronto para o CI da tarefa 002, que pode trocar a varredura por gitleaks.
- `@lhci/cli` não está em devDependencies porque suas dependências transitivas (lighthouse, puppeteer-core, extract-zip, tmp, basic-ftp) têm avisos de severidade alta no `npm audit` sem correção disponível. Ele roda por `npx @lhci/cli@0.15.1`, fora da árvore auditada, usando o Chromium do Playwright via `CHROME_PATH`. Reavaliar quando houver versão corrigida.
- Disco: a máquina ficou com pouco espaço livre durante a instalação (falha ENOSPC). O cache do npm foi limpo. Manter pelo menos 2 GB livres para instalar dependências, Chromium e rodar o Lighthouse.
- O build usa fontes do sistema (sem Google Fonts) para não depender de rede.

## Pendências de ambiente

- Repositório remoto: aguardando decisão do Mathaus.
- O `chrome.exe` do Playwright não inicia nesta máquina (erro de configuração lado a lado do Windows); o Lighthouse usa o chrome-headless-shell do Playwright.
- Docker Desktop: depende da TI. Registrar a versão aqui quando instalado.
