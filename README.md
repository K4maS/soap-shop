# Mylo Master — Production B2B/B2C Soap & Cosmetics Shop

Enterprise-grade e-commerce platform for soap and cosmetic bases with security-first architecture.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express + TypeScript + Prisma |
| Database | PostgreSQL 16 |
| Cache / Rate Limit | Redis 7 |
| Reverse Proxy | Nginx 1.25 |
| Infrastructure | Docker + Docker Compose |

## Architecture

```
Internet → Nginx (TLS, rate limit) → [public_net]
                                           ↓
                              ┌─────────────────────┐
                              │    [internal_net]    │
                              │  API   Auth   Admin  │
                              └─────────────────────┘
                                           ↓
                              ┌─────────────────────┐
                              │      [db_net]        │
                              │  PostgreSQL   Redis  │
                              └─────────────────────┘
```

- **PostgreSQL и Redis недоступны снаружи** — только internal Docker network
- **Nginx** — единственная публичная точка входа, TLS termination
- Все контейнеры работают **от non-root пользователей**

## Security features

- OTP authentication via SMS (argon2id hash, single-use, 5 min TTL)
- JWT с rotation refresh tokens + blacklist (Redis)
- RBAC (customer / manager / admin / accountant)
- AES-256-GCM шифрование чувствительных данных в БД
- Rate limiting: Redis-backed, per IP + per phone
- Anti-fraud scoring на заказы
- Audit logging (immutable, 90 дней retention)
- OWASP Top 10 mitigations (CSRF, XSS, SQL Injection, IDOR, ...)
- CSP, HSTS, security headers

## Quick start (development)

```bash
# 1. Clone
git clone https://github.com/yourorg/mylo-master.git
cd mylo-master

# 2. Copy env
cp .env.example .env

# 3. Generate secrets
bash scripts/generate-secrets.sh >> .env

# 4. Start services
docker-compose -f docker-compose.dev.yml up -d

# 5. Run migrations + seeds
docker-compose -f docker-compose.dev.yml exec api npx prisma migrate dev
docker-compose -f docker-compose.dev.yml exec api npx tsx database/seeds/01_categories.ts
docker-compose -f docker-compose.dev.yml exec api npx tsx database/seeds/02_products.ts

# 6. Start frontend (local)
cd frontend && npm install && npm run dev
```

**Dev URLs:**
- Frontend: http://localhost:5173
- API: http://localhost:3001
- Auth: http://localhost:3002
- Admin service: http://localhost:3003

In development, SMS OTP is **printed to the auth-service logs** (mock provider).

## Production deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide.

```bash
# Quick production start
cp .env.example .env
# Edit .env with real secrets, domain, credentials
docker-compose up -d --build
```

## Project structure

```
mylo-master/
├── frontend/                  # React 18 SPA
├── backend/
│   ├── api/                   # Main REST API (port 3001)
│   ├── auth-service/          # OTP + JWT auth (port 3002)
│   └── admin-service/         # CRM/admin API (port 3003)
├── database/
│   ├── migrations/            # Prisma migrations
│   ├── seeds/                 # Seed data
│   └── init/                  # PostgreSQL init scripts
├── nginx/                     # Nginx config + snippets
├── scripts/                   # Deployment scripts
├── docs/                      # Documentation
├── docker-compose.yml         # Production
└── docker-compose.dev.yml     # Development
```

## API Overview

### Auth (auth-service :3002)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/phone/request` | Request OTP |
| POST | `/api/v1/auth/phone/verify` | Verify OTP → tokens |
| POST | `/api/v1/auth/refresh` | Rotate tokens |
| POST | `/api/v1/auth/logout` | Revoke tokens |

### Products (api :3001)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/products` | — | List products |
| GET | `/api/v1/products/categories` | — | List categories |
| GET | `/api/v1/products/:slug` | — | Product detail |
| POST | `/api/v1/products` | admin | Create product |
| PUT | `/api/v1/products/:id` | admin/manager | Update product |
| DELETE | `/api/v1/products/:id` | admin | Soft delete |

### Orders (api :3001)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/orders` | customer | Create order |
| GET | `/api/v1/orders` | customer | My orders |
| GET | `/api/v1/orders/:id` | customer | Order detail |
| PATCH | `/api/v1/orders/:id/status` | staff | Update status |

### Payments (api :3001)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/payments/initiate` | customer | Start YooKassa payment |
| GET | `/api/v1/payments/:id/status` | customer | Get payment status |
| POST | `/api/v1/payments/webhook` | — | YooKassa webhook handler |

### Cart (api :3001)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/cart` | customer |
| POST | `/api/v1/cart/items` | customer |
| PATCH | `/api/v1/cart/items/:id` | customer |
| DELETE | `/api/v1/cart/items/:id` | customer |

## Running tests

```bash
# Auth service
cd backend/auth-service && npm test

# API service
cd backend/api && npm test

# With coverage
npm run test -- --coverage
```

## Security checklist

See [docs/SECURITY.md](docs/SECURITY.md)

## License

Private — All rights reserved
