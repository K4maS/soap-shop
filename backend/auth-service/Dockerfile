# =============================================================
# Auth Service Dockerfile — multi-stage, non-root user
# =============================================================

# ─── Stage 1: Dependencies ────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# argon2 native addon requires build tools on Alpine
RUN apk add --no-cache python3 make g++

COPY ./auth-service/package.json ./auth-service/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: Builder (for development with tsx) ─────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY ./auth-service/package.json ./auth-service/package-lock.json ./
RUN npm ci

COPY ./auth-service/tsconfig.json ./
COPY ./auth-service/src ./src
COPY ./api/prisma ./prisma

RUN npx prisma generate 2>/dev/null || true

RUN npm run build

# ─── Stage 3: Production ──────────────────────────────────
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY --from=deps    --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=appuser:appgroup ./auth-service/package.json ./

USER appuser

EXPOSE 3002

STOPSIGNAL SIGTERM

CMD ["node", "dist/app.js"]
