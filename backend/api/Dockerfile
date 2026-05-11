# =============================================================
# API Service Dockerfile — multi-stage, non-root user
# =============================================================

# ─── Stage 1: Production dependencies ────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: Builder (for development with tsx) ──────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

RUN npm run build

# ─── Stage 3: Production image ────────────────────────────────
FROM node:20-slim AS production

# Security: non-root user
RUN groupadd -g 1001 appgroup &&     useradd -u 1001 -g appgroup -s /bin/sh appuser

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps    --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy compiled output
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Copy Prisma client
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma

# Copy minimal runtime metadata
COPY --chown=appuser:appgroup package.json ./

# Security: drop to non-root user
USER appuser

EXPOSE 3001

STOPSIGNAL SIGTERM

CMD ["node", "dist/app.js"]
