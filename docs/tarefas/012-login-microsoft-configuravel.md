# 012 - Login com provedor Microsoft configurável e sessão por cookies
Fase: 1 | Status: a fazer | Modelo do desenvolvedor: opus

## Objetivo
Implementar o fluxo de login com sessão em cookies seguros (@supabase/ssr) funcionando localmente com o Supabase local, com o provedor Microsoft (Entra ID) configurável por variáveis de ambiente, sem fixar nenhum valor de tenant, cliente ou domínio, para que a configuração da TI entre depois sem mudar código.

## Escopo
Inclui:
- Configuração do provedor Azure/Microsoft em supabase/config.toml lendo client id, segredo, URL do tenant e endereço de retorno de variáveis de ambiente (nomes documentados em .env.example; sem valores).
- Página de login em src/app/(auth), em português do Brasil, com botão "Entrar com a conta Microsoft" que fica desabilitado, com aviso claro, quando o provedor não está configurado.
- Rota de callback (Route Handler) que troca o código por sessão e grava cookies seguros (HttpOnly, Secure fora do local, SameSite), com validação do parâmetro de retorno contra open redirect.
- Ação de sair (logout) que encerra a sessão e limpa cookies.
- Modo de login apenas para desenvolvimento local, por e-mail e senha de usuários de teste do seed, ativo somente quando a variável de ambiente do ambiente local o permite e nunca em produção; os e-mails e senhas de teste ficam no seed/exemplo, nunca no código de produção.
- Testes e2e do fluxo com usuário de teste local.

Não inclui: hook de domínio (013), proxy e tela de aguardando liberação (014), administração de perfis (015), registro do app no Entra ID (feito pela TI).

## Arquivos afetados
supabase/config.toml, .env.example, src/app/(auth)/login/*, src/app/auth/callback/route.ts, src/lib/data (sessão), tests/e2e/*.

## Critérios de aceite
- [ ] Com Supabase local, um usuário de teste consegue entrar, tem sessão em cookie e consegue sair.
- [ ] Sem as variáveis do Microsoft, a página mostra o botão desabilitado e a mensagem explicando; nada quebra.
- [ ] Com variáveis fictícias, a URL de autorização montada aponta para o provedor configurado (verificado sem fixar valores no código).
- [ ] Nenhum valor de tenant, domínio, client id ou segredo existe no código ou no repositório (gitleaks e busca).
- [ ] Parâmetro de retorno externo (https://outro-site) é rejeitado no callback.
- [ ] Cookies de sessão são HttpOnly e SameSite; em produção Secure.
- [ ] O modo de login local não está disponível quando o ambiente não é local (teste unitário da condição).
- [ ] Acesso por perfil: login não concede dados; usuário sem perfil, depois de logado, continua sem ler nada (RLS, coberto em 010).

## Testes esperados
Unitários: validação de redirecionamento, condição do modo local, leitura da configuração. e2e: login e logout com usuário de teste; página com provedor ausente. pgTAP: não se aplica. Performance: Lighthouse na página de login. Segurança: open redirect, cookies, ausência de segredo, enumeração de usuários.

## Riscos e dependências
- Depende de 004 e 005. Risco alto: modo de login local ativo em produção por engano; open redirect; sessão vazando em cache.
- O fluxo real com a Microsoft só poderá ser validado após o registro no Entra ID pela TI; esse teste fica pendente e registrado, não bloqueia a tarefa.

## Dúvidas para o Mathaus
- Quando a TI deve entregar o registro do aplicativo no Entra ID (tenant, client id, segredo e endereços de retorno local, teste e produção)?
- Alguma conta de teste Microsoft pode ser usada no ambiente de teste?

## Entrega (preenchido pelo desenvolvedor)
