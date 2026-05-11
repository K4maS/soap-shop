#!/bin/bash
# =============================================================
# Database migration script
# Run from project root: ./scripts/migrate.sh
# =============================================================
set -euo pipefail

ENV=${1:-production}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENV" = "dev" ] || [ "$ENV" = "development" ]; then
  COMPOSE_FILE="docker-compose.dev.yml"
fi

echo "Running migrations (env: $ENV)..."

# Run prisma migrate deploy via api container
docker-compose -f "$COMPOSE_FILE" exec api npx prisma migrate deploy

echo "Running seeds..."
docker-compose -f "$COMPOSE_FILE" exec api npx tsx database/seeds/01_categories.ts
docker-compose -f "$COMPOSE_FILE" exec api npx tsx database/seeds/02_products.ts

echo "Done."
