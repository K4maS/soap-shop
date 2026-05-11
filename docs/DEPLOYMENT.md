# Mylo Master — Deployment Guide

## Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Docker | 24.x | With Docker Compose v2 plugin |
| Docker Compose | 2.x | `docker compose` (no hyphen) |
| Domain name | — | A/AAAA records pointing to your server |
| SSL certificate | — | Via Let's Encrypt (certbot) — see step 5 |
| RAM | 2 GB | 4 GB recommended for production |
| Disk | 20 GB | Plus backup storage |

---

## Step 1: Clone the repository

```bash
git clone https://github.com/your-org/soap-shop.git /opt/mylo-master
cd /opt/mylo-master
```

---

## Step 2: Copy environment template

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in **all** `CHANGE_ME` values:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`
- `CSRF_SECRET`
- `SESSION_SECRET`
- `APP_URL` and `ADMIN_URL`
- `CORS_ORIGINS`
- `COOKIE_DOMAIN`

---

## Step 3: Generate cryptographic secrets

```bash
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh
```

Copy the output lines into your `.env` file, replacing the corresponding
`CHANGE_ME` placeholders.

**Never commit `.env` to version control.**

---

## Step 4: Build and start services

```bash
# First run: build all images and start
docker compose up -d --build

# Check all services are healthy
docker compose ps
```

Expected output: all services with status `healthy` or `running`.

---

## Step 5: SSL setup with certbot

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
certbot certonly \
  --nginx \
  --non-interactive \
  --agree-tos \
  --email admin@yourdomain.com \
  -d yourdomain.com \
  -d admin.yourdomain.com

# Certificates are saved to /etc/letsencrypt/live/yourdomain.com/
```

Update `nginx/conf.d/main.conf` with your domain and certificate paths,
then reload Nginx:

```bash
docker compose exec nginx nginx -s reload
```

Auto-renewal via cron:

```bash
echo "0 3 * * * certbot renew --quiet --post-hook 'docker compose -f /opt/mylo-master/docker-compose.yml exec nginx nginx -s reload'" | crontab -
```

---

## Step 6: Run database migrations

```bash
docker compose exec api npx prisma migrate deploy
```

---

## Step 7: Seed initial data

```bash
# Seed categories
docker compose exec api npx tsx database/seeds/01_categories.ts

# Seed sample products
docker compose exec api npx tsx database/seeds/02_products.ts
```

---

## Step 8: Create the first admin user

The auth service uses phone-based OTP authentication.
To promote an existing account to admin, run:

```bash
docker compose exec api npx tsx scripts/promote-admin.ts --phone "+7XXXXXXXXXX"
```

Or connect directly to the database:

```bash
docker compose exec postgres psql -U mylo_app -d mylo_master

UPDATE users
SET role = 'admin'
WHERE phone_hash = encode(hmac('+7XXXXXXXXXX', left(current_setting('app.encryption_key'), 16), 'sha256'), 'hex');
```

---

## Step 9: Verify health checks

```bash
# API service
curl -sf https://yourdomain.com/api/health | jq .

# Auth service
curl -sf https://yourdomain.com/auth/health | jq .

# Admin service
curl -sf https://admin.yourdomain.com/health | jq .

# Expected response:
# { "status": "ok", "checks": { "database": "ok", "redis": "ok" } }
```

---

## Step 10: Set up automated backups

```bash
chmod +x scripts/backup.sh

# Test backup
./scripts/backup.sh

# Schedule daily backup at 03:00 UTC
echo "0 3 * * * /opt/mylo-master/scripts/backup.sh >> /var/log/mylo-backup.log 2>&1" | crontab -
```

For S3 upload, ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_REGION`, and `AWS_S3_BUCKET` are set in `.env`.

---

## Monitoring setup notes

- **Uptime monitoring**: set up pings to `/health` endpoints every 60 seconds
  from an external service (Uptime Robot, Better Uptime, etc.)
- **Log aggregation**: forward pino JSON logs to your ELK stack or Loki:
  ```bash
  docker compose logs -f api | node scripts/log-forward.js
  ```
- **Metrics**: expose `/metrics` via a prom-client middleware and scrape
  with Prometheus + Grafana (not included by default — see `docs/MONITORING.md`)
- **Alerts**: configure alerts for `status >= 500` log events and
  Redis/DB connectivity failures

---

## Rollback procedure

### Application rollback

```bash
# Pull previous image tag
docker compose pull api:v1.2.3

# Update docker-compose.yml to pin the previous image tag
# Then redeploy
docker compose up -d api

# Or rollback all services at once
git checkout v1.2.3
docker compose up -d --build
```

### Database rollback

```bash
# List applied migrations
docker compose exec api npx prisma migrate status

# Roll back to a specific migration
# WARNING: this may cause data loss — always backup first
docker compose exec api npx prisma migrate resolve --rolled-back <migration_name>
```

### Emergency restore from backup

```bash
# Stop services to prevent writes during restore
docker compose stop api auth-service admin-service

# Restore from a backup file
PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  --host=localhost \
  --port=5432 \
  --username=mylo_app \
  --dbname=mylo_master \
  --no-password \
  --verbose \
  /backups/mylo_master_20260101_030000.sql.gz

# Restart services
docker compose start api auth-service admin-service
```
