#!/bin/bash
# =============================================================
# Create first admin user
# Usage: ./scripts/create-admin.sh +79001234567
# =============================================================
set -euo pipefail

PHONE=${1:?"Usage: $0 <phone>"}
ENV=${2:-production}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENV" = "dev" ]; then
  COMPOSE_FILE="docker-compose.dev.yml"
fi

echo "Promoting $PHONE to admin role..."

docker-compose -f "$COMPOSE_FILE" exec postgres psql \
  -U "${POSTGRES_USER:-mylo_app}" \
  -d "${POSTGRES_DB:-mylo_master}" \
  -c "
    UPDATE users
    SET role = 'admin', status = 'active'
    WHERE phone_hash = encode(hmac(lower(trim('$PHONE')), substring(current_setting('app.encryption_key'), 1, 16), 'sha256'), 'hex')
    RETURNING id, role, status;
  "

echo "Done. User promoted to admin."
