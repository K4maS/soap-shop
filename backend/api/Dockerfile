# =============================================================
# API Service Dockerfile — multi-stage, non-root user
# =============================================================

# ─── Stage 1: Production dependencies ────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Security: install only production deps in a separate layer
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ─── Stage 2: Builder (for development with tsx) ──────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (including devDeps for TypeScript compiler)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Copy Prisma schema so prisma generate runs against the correct schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate 2>/dev/null || true

RUN npm run build

# ─── Stage 3: Production image ────────────────────────────────
FROM node:20-alpine AS production

# Security: non-root user (UID 1001 matches common Docker conventions)
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps    --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy compiled output
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Copy Prisma client (generated in builder stage)
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma

# Copy minimal runtime metadata
COPY --chown=appuser:appgroup package.json ./

# Security: drop to non-root user
USER appuser

# Expose API port
EXPOSE 3001

# Correct signal forwarding for graceful shutdown
STOPSIGNAL SIGTERM

# Run without a shell so SIGTERM is delivered directly to Node
CMD ["node", "dist/app.js"]
