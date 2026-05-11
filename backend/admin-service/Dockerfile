# =============================================================
# Admin Service Dockerfile — multi-stage, non-root user
# =============================================================

# ─── Stage 1: Production dependencies ────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY ./admin-service/package.json ./admin-service/package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ─── Stage 2: Builder (used for development with tsx) ──────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY ./admin-service/package.json ./admin-service/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY ./admin-service/tsconfig.json ./
COPY ./admin-service/src ./src

# Share Prisma schema with the api service (sibling directory)
COPY ./api/prisma ./prisma

RUN npx prisma generate
RUN npm run build

# ─── Stage 3: Production image ────────────────────────────────
FROM node:20-alpine AS production

# Security: non-root user UID 1001
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY --from=deps    --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=appuser:appgroup ./admin-service/package.json ./

USER appuser

EXPOSE 3003

STOPSIGNAL SIGTERM

CMD ["node", "dist/app.js"]
