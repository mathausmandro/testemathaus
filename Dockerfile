# syntax=docker/dockerfile:1
# Etapas: deps -> dev (desenvolvimento) -> build -> runner (imagem final, usuário não root).
# Nenhum segredo entra na imagem: só as variáveis NEXT_PUBLIC_* (públicas) são aceitas como ARG de build.
# SUPABASE_SECRET_KEY e ALLOWED_EMAIL_DOMAIN chegam apenas em tempo de execução, por env_file do compose.

ARG NODE_VERSION=24

# 1. Dependências (reaproveita cache enquanto o lockfile não muda)
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# 2. Desenvolvimento (perfil dev do compose; o código vem por volume)
FROM node:${NODE_VERSION}-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
# Pastas que os volumes nomeados do compose herdam: precisam existir e pertencer ao usuário node.
RUN mkdir -p .next && chown node:node /app .next
USER node
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]

# 3. Build (gera .next/standalone)
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Somente valores públicos: o Next embute NEXT_PUBLIC_* no código do navegador.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. Imagem final: só o necessário para executar, sem privilégio de administrador
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server.js"]
