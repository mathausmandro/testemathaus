---
name: microsoft-auth-domain
description: Use ao implementar ou alterar o login Microsoft, a restrição de domínio, a sessão por cookies, o proxy.ts e a atribuição de perfis.
---

## Passos
1. Provedor Microsoft (Entra ID) no Supabase Auth, com o app registrado pela TI como tenant único. Localmente, configure em supabase/config.toml.
2. Pacote @supabase/ssr: sessão em cookies seguros, renovada no servidor.
3. Domínio em duas camadas: tenant único e Before User Created Hook que recusa e-mail fora de ALLOWED_EMAIL_DOMAIN. Confira a claim xms_edov para e-mail verificado.
4. Primeiro login sem perfil; tela de aguardando liberação. Só coordination atribui perfil.
5. src/proxy.ts (Next.js 16) bloqueia páginas sem sessão ou sem perfil.
6. Cada chamada ao Supabase leva o token Bearer da sessão; a segurança real é a RLS.

## Cuidados
- Domínio lido de variável de ambiente; nunca fixe no código.
- Chave secreta nunca no navegador.
- Teste: e-mail de outro domínio é recusado; usuário sem perfil não vê dados.
