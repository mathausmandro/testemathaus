---
name: docker-local-env
description: Use ao criar ou alterar Dockerfile, docker-compose, variáveis locais e testes em container.
---

## Passos
1. Dockerfile em etapas: dependências, desenvolvimento, build e imagem final sem privilégio de administrador.
2. docker compose com perfis dev e prod.
3. output standalone no next.config.
4. .env.example versionado; valores reais em .env.local, fora do repositório.
5. Banco local pelo Supabase CLI (supabase start); prévias usam o projeto de teste; nunca produção.
6. Na fase 6, rodar no container os testes de acesso, segurança e performance antes de cada publicação.

## Cuidados
- SUPABASE_SECRET_KEY nunca na imagem nem no repositório.
- Meta: dev novo sobe o sistema em menos de 15 minutos.
