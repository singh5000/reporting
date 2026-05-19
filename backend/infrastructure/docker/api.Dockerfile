# =============================================================================
# 360CRD API - Multi-stage Dockerfile
# =============================================================================

# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl
RUN npm install -g turbo

# ── Pruner — extract only what the api app needs ──────────────────────────────
FROM base AS pruner
COPY . .
RUN turbo prune --scope="@360crd/api" --docker

# ── Dependency installer ──────────────────────────────────────────────────────
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci --frozen-lockfile

# ── Prisma generate ───────────────────────────────────────────────────────────
COPY --from=pruner /app/out/full/ .
RUN cd packages/database && npx prisma generate

# ── Builder ───────────────────────────────────────────────────────────────────
FROM installer AS builder
RUN turbo run build --filter="@360crd/api"

# ── Development (hot-reload) ──────────────────────────────────────────────────
FROM installer AS development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@360crd/api"]

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache curl

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 crd360api

COPY --from=builder --chown=crd360api:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=crd360api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=crd360api:nodejs /app/packages/database/prisma ./prisma

USER crd360api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
