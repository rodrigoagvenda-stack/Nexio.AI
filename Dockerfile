# Dockerfile para Nexio.AI CRM - Next.js 14 (Seguro)
FROM node:20-alpine AS base

# 1. Dependências
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar package files
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ⚠️ APENAS variáveis PÚBLICAS como build args (ficam no bundle do cliente)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build with increased memory limit to avoid OOM during trace collection
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Debug: listar o que foi gerado
RUN ls -la .next/ || echo ".next not found" && \
    ls -la .next/standalone/ || echo "standalone not found"

# 3. Runner - Produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos necessários
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Standalone contém node_modules otimizados e server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static files (JS, CSS, etc)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 🔒 SECRETS são injetados em RUNTIME via env vars do EasyPanel
# Não use ARG para secrets! O EasyPanel vai passar automaticamente:
# - SUPABASE_SERVICE_ROLE_KEY
# - N8N_WEBHOOK_SECRET
# - N8N_WEBHOOK_MAPS
# - N8N_WEBHOOK_ICP
# - N8N_WEBHOOK_WHATSAPP

CMD ["node", "server.js"]
