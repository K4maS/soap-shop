# =============================================================================
# Mylo Master Frontend — Multi-stage Dockerfile
# Stage 1: Build  (Node 20 + npm)
# Stage 2: Serve  (nginx alpine, non-root user)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — Dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies with frozen lockfile for reproducible builds
COPY package.json package-lock.json* ./

RUN npm ci --prefer-offline --no-audit --no-fund --legacy-peer-deps

# ---------------------------------------------------------------------------
# Stage 2 — Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy installed deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Build args — passed at build time via --build-arg
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_NAME=MyloMaster
ARG NODE_ENV=production

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV NODE_ENV=${NODE_ENV}

# Type-check + build
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3 — Production nginx server
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Set correct ownership
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown appuser:appgroup /var/run/nginx.pid

# nginx needs to write to /tmp
RUN chmod 777 /tmp

# Switch to non-root
USER appuser

# Expose HTTP port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
