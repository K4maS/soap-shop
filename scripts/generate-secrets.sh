#!/bin/bash
# =============================================================
# Mylo Master — Secret generator
# Generates all required secrets and writes them to .env
#
# Usage:
#   ./scripts/generate-secrets.sh              # print to stdout
#   ./scripts/generate-secrets.sh > .env.local # redirect to file
#
# Prerequisites: openssl must be installed (standard on Linux/macOS).
# =============================================================

set -euo pipefail

# ─── Safety check ─────────────────────────────────────────────
if [[ ! -f "$(dirname "$0")/../.env.example" ]]; then
  echo "ERROR: .env.example not found. Run this script from the project root." >&2
  exit 1
fi

echo "# ==============================================================" >&2
echo "# Mylo Master — Generated secrets ($(date -u +%Y-%m-%dT%H:%M:%SZ))" >&2
echo "# DO NOT commit this file to version control!" >&2
echo "# ==============================================================" >&2

# ─── JWT secrets (64 bytes = 512 bits) ─────────────────────────
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"

# ─── AES-256 encryption key (32 bytes = 256 bits) ──────────────
echo "ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')"

# ─── CSRF secret (32 bytes) ────────────────────────────────────
echo "CSRF_SECRET=$(openssl rand -base64 32 | tr -d '\n')"

# ─── Redis password (24 bytes) ─────────────────────────────────
echo "REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')"

# ─── PostgreSQL password (24 bytes) ────────────────────────────
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')"

# ─── Session secret (32 bytes) ─────────────────────────────────
echo "SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')"

echo "" >&2
echo "Secrets generated. Paste the above lines into your .env file." >&2
echo "Then set the remaining non-secret values from .env.example." >&2
