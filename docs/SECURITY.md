# Mylo Master — Security Documentation

## Pre-deployment Security Checklist

### Secrets & Configuration

- [ ] All `CHANGE_ME` values in `.env` replaced with real secrets
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are at least 64 bytes (generated with `openssl rand -base64 64`)
- [ ] `ENCRYPTION_KEY` is exactly 32 bytes (generated with `openssl rand -base64 32`)
- [ ] `NODE_ENV=production` is set
- [ ] `.env` is in `.gitignore` and never committed
- [ ] All secrets rotated from development to production values

### Network & Transport

- [ ] HTTPS enforced for all public endpoints (no HTTP)
- [ ] HSTS header present with `max-age >= 31536000`, `includeSubDomains`, `preload`
- [ ] TLS 1.2+ only (TLS 1.0 and 1.1 disabled in Nginx)
- [ ] Redirect all HTTP to HTTPS in Nginx
- [ ] `CORS_ORIGINS` contains only production domains (no `localhost`)
- [ ] `COOKIE_DOMAIN` set to `.yourdomain.com`

### Authentication & Tokens

- [ ] Access tokens expire in 15 minutes (`JWT_ACCESS_EXPIRES=15m`)
- [ ] Refresh tokens are `httpOnly; Secure; SameSite=Strict` cookies
- [ ] Token blacklist checked in Redis on every authenticated request
- [ ] Refresh token rotation on every use (revoke old JTI, issue new)
- [ ] OTP rate limiting per phone number and per IP is active
- [ ] OTP blocked after 3 failed attempts for 15 minutes

### Database & Queries

- [ ] All queries go through Prisma ORM (parameterized — no raw interpolation)
- [ ] `DATABASE_URL` uses `sslmode=require` in production
- [ ] Database user `mylo_app` has no superuser or DDL privileges
- [ ] PostgreSQL accessible only from the Docker internal network (no public port)

### API Security

- [ ] Body size limit 10 KB (prevents large JSON payload attacks)
- [ ] Rate limiter active on all endpoints (backed by Redis)
- [ ] All protected routes verified with JWT before business logic
- [ ] RBAC: role from JWT, never from request body or query
- [ ] Ownership checks (IDOR prevention): 404 for unauthorized resource access
- [ ] Server-side price validation — frontend prices are never trusted
- [ ] Anti-fraud scoring on order creation

### File Uploads

- [ ] Files stored in memory (not disk) until MIME validation
- [ ] MIME type verified via magic bytes, not file extension
- [ ] Upload directory is outside the web root
- [ ] Max file size enforced at both Multer and service layers
- [ ] Only JPEG/PNG/WebP accepted

### Logging & Audit

- [ ] Sensitive fields (`phone`, `email`, `password`, `token`, `otp`) redacted in pino
- [ ] Audit log written for all significant actions
- [ ] `AuditService.sanitizeMetadata()` strips sensitive keys from metadata
- [ ] Audit logs retain 90 days minimum
- [ ] No stack traces in production error responses

### Infrastructure

- [ ] All services run as non-root user (UID 1001)
- [ ] Docker images based on `node:20-alpine` (minimal attack surface)
- [ ] Redis requires password authentication
- [ ] Automated backups scheduled and tested
- [ ] SSL certificates auto-renewed via certbot

---

## Common Attack Vectors and Mitigations

### SQL Injection
**Mitigation:** All database queries use Prisma ORM with parameterized
queries. The application never constructs raw SQL with user input.

### Cross-Site Scripting (XSS)
**Mitigation:** Helmet sets `Content-Security-Policy` restricting script
sources to `'self'`. Refresh tokens are `httpOnly` — inaccessible to JS.
API responses are JSON (not HTML), reducing XSS surface.

### Cross-Site Request Forgery (CSRF)
**Mitigation:** CSRF tokens required for all state-changing requests.
Refresh tokens use `SameSite=Strict` cookies. CORS whitelist prevents
cross-origin reads.

### Insecure Direct Object Reference (IDOR)
**Mitigation:** Every resource fetch includes an ownership check.
Non-admin users receive 404 (not 403) for resources belonging to other
users — this prevents enumeration.

### Brute Force / Credential Stuffing
**Mitigation:** OTP rate limiting (1 request per 60 seconds per phone,
5 per hour per IP). Account blocked after 3 failed OTP attempts.
Global Redis-backed rate limiter on all endpoints.

### Timing Attacks
**Mitigation:** `crypto.timingSafeEqual` used for token comparisons.
Argon2id used for OTP/password hashing (constant-time verification).

### Mass Assignment
**Mitigation:** All Zod schemas use `.strict()` to reject unknown fields.
Prisma `select` clauses explicitly list returned fields.

### Sensitive Data Exposure
**Mitigation:** Phones stored encrypted (AES-256-GCM) + hashed (HMAC-SHA256)
for search. Emails encrypted at rest. Cost prices excluded from public API.
PII masked in admin UI (last 4 digits only).

### JWT Algorithm Confusion
**Mitigation:** `algorithms: ['HS256']` is explicitly set in `jwt.verify()`.
Separate secrets for access and refresh tokens.

---

## Incident Response Playbook

### Data Breach

1. **Detect & contain**
   - Identify affected services from audit logs
   - Revoke all active sessions: `FLUSHDB` on Redis (or targeted key deletion)
   - Rotate all JWT secrets immediately (see Key Rotation below)
   - Take the database offline if active exfiltration is suspected

2. **Assess scope**
   - Query audit logs for the affected time window
   - Identify affected user IDs (`actorId`, `subjectId`)
   - Determine what data was accessed (phone hashes, encrypted fields)

3. **Notify**
   - Legal team and DPO within 24 hours (GDPR Article 33: 72-hour notification)
   - Affected users via in-app message and/or email (if contacts available)
   - Relevant authorities (Roskomnadzor) if required

4. **Remediate**
   - Patch the vulnerability
   - Re-encrypt any compromised data
   - Force re-authentication of all users

5. **Post-mortem**
   - Document timeline, root cause, and remediation steps
   - Update runbooks and security checklist

### Account Compromise

1. Immediately disable the compromised account:
   ```sql
   UPDATE users SET is_active = false WHERE id = '<user_id>';
   ```
2. Revoke all active tokens for the user:
   ```bash
   # Redis: blacklist all JTIs for the user
   # (requires scanning refresh_tokens table)
   ```
3. Notify the user through a verified secondary channel
4. Investigate: check audit logs for actions taken while compromised
5. Re-enable account only after identity re-verification

---

## Key Rotation Procedure

### JWT Secret Rotation

Rotating JWT secrets invalidates all active tokens — users must re-authenticate.
Schedule during a low-traffic maintenance window.

```bash
# 1. Generate a new secret
NEW_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# 2. Update .env
sed -i "s/^JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=${NEW_SECRET}/" .env

# 3. Optionally keep the old secret in JWT_ACCESS_SECRET_PREV for a
#    grace period (requires code support for dual-secret verification)

# 4. Restart services (new tokens issued with new secret)
docker compose restart api auth-service admin-service

# 5. All existing access tokens immediately invalid
# 6. Users will get TOKEN_EXPIRED/INVALID_TOKEN and be redirected to login
```

### Encryption Key Rotation

Rotating `ENCRYPTION_KEY` requires re-encrypting all data encrypted with
the old key. This is a sensitive, offline operation.

```bash
# 1. Generate a new key
NEW_KEY=$(openssl rand -base64 32 | tr -d '\n')

# 2. Run the re-encryption script (must be written for your schema)
docker compose exec api npx tsx scripts/rotate-encryption-key.ts \
  --old-key="${ENCRYPTION_KEY}" \
  --new-key="${NEW_KEY}"

# 3. Update .env with the new key
# 4. Restart services
docker compose restart api auth-service admin-service
```

### Redis Password Rotation

```bash
# 1. Generate a new password
NEW_REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')

# 2. Update Redis config (without downtime using AUTH command)
docker compose exec redis redis-cli CONFIG SET requirepass "${NEW_REDIS_PASSWORD}"

# 3. Update .env
sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=${NEW_REDIS_PASSWORD}/" .env

# 4. Restart services to pick up new password
docker compose restart api auth-service admin-service
```
