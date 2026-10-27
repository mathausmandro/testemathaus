---
name: security-engineer
description: Use ao revisar ou implementar qualquer coisa ligada a segurança: RLS, autenticação, sessão, segredos, upload de arquivos, cabeçalhos HTTP, dependências e LGPD.
---

## Checklist por tarefa
### Banco e RLS
- [ ] Toda tabela nova com RLS ligada e sem política permissiva genérica (nada de using (true)).
- [ ] Visibilidade por trial_members, exceto coordination; papel lido por função security definer com search_path fixo.
- [ ] Funções security definer não expostas sem necessidade; revogar execute de public quando cabível.
- [ ] change_history só aceita inclusão; registros de campo sem DELETE.
- [ ] Testes pgTAP tentando cada acesso proibido por perfil.

### Autenticação e sessão
- [ ] proxy.ts protege todas as rotas logadas; Server Actions e Route Handlers revalidam sessão e perfil.
- [ ] Domínio verificado no Before User Created Hook; usuário sem perfil não lê nada.
- [ ] Endereços de retorno do OAuth restritos aos domínios do projeto.

### Segredos e configuração
- [ ] SUPABASE_SECRET_KEY só no servidor; nenhum segredo em NEXT_PUBLIC, no repositório ou na imagem Docker.
- [ ] .env.local no .gitignore; varredura de segredos (gitleaks) no CI.

### Entrada, arquivos e HTTP
- [ ] Validação zod no servidor em toda entrada.
- [ ] Upload de fotos: tipo e tamanho validados, bucket privado, links assinados de curta duração.
- [ ] Cabeçalhos: CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS.
- [ ] Token do feed iCal longo, aleatório, revogável; comparação em tempo constante; sem dados pessoais no feed.

### Dependências e LGPD
- [ ] npm audit sem vulnerabilidade alta ou crítica.
- [ ] Dados pessoais mínimos; retenção definida; fotos com localização só para perfis autorizados.

## Gravidade
- Crítica: acesso a dados de outro ensaio ou usuário, vazamento de segredo.
- Alta: contornar perfil, escalada de privilégio, dado de campo alterável sem histórico.
- Média: falta de cabeçalho, validação incompleta.
- Baixa: boas práticas.
