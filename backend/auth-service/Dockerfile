# =============================================================
# Auth Service Dockerfile — multi-stage, non-root user
# =============================================================

# ─── Stage 1: Dependencies ────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

# argon2 native addon requires build tools on Debian
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: Builder (for development with tsx) ─────────
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate

RUN npm run build

# ─── Stage 3: Production ──────────────────────────────────
FROM node:20-slim AS production

RUN groupadd -g 1001 appgroup &&     useradd -u 1001 -g appgroup -s /bin/sh appuser

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
