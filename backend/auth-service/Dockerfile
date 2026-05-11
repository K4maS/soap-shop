# =============================================================
# Auth Service Dockerfile — multi-stage, non-root user
# Base: node:20-slim (Debian Bookworm Slim, glibc)
# Note: python3/make/g++ required for argon2 native addon
# =============================================================

# ─── Stage 1: Production dependencies ────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: Builder ─────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate
RUN npm run build

# ─── Stage 3: Production image ────────────────────────────────
FROM node:20-slim AS production

# Security: non-root user (Debian syntax)
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/false --no-create-home appuser

WORKDIR /app

COPY --from=deps    --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=appuser:appgroup package.json ./

USER appuser

EXPOSE 3002

STOPSIGNAL SIGTERM

CMD ["node", "dist/app.js"]
