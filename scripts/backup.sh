#!/bin/bash
# =============================================================
# Mylo Master — PostgreSQL backup script
#
# Features:
# - pg_dump with gzip compression
# - Date-based filename
# - Retention: delete local backups older than 30 days
# - Optional S3 upload (if AWS credentials are present)
#
# Usage (manually):
#   ./scripts/backup.sh
#
# Usage (cron, daily at 3 AM):
#   0 3 * * * /app/scripts/backup.sh >> /var/log/mylo-backup.log 2>&1
#
# Required environment variables (can be loaded from .env):
#   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB,
#   POSTGRES_USER, POSTGRES_PASSWORD
#
# Optional (for S3 upload):
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
#   AWS_S3_BUCKET
# =============================================================

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE_TAG="$(date -u +%Y%m%d_%H%M%S)"
FILENAME="mylo_master_${DATE_TAG}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

# ─── Load .env if running outside Docker ───────────────────────
if [[ -f "$(dirname "$0")/../.env" ]]; then
  # shellcheck source=/dev/null
  set -a
  source "$(dirname "$0")/../.env"
  set +a
fi

# ─── Validate required env vars ────────────────────────────────
for VAR in POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "[backup] ERROR: ${VAR} is not set" >&2
    exit 1
  fi
done

# ─── Ensure backup directory exists ───────────────────────────
mkdir -p "${BACKUP_DIR}"

# ─── Create backup ─────────────────────────────────────────────
echo "[backup] Starting backup: ${FILENAME}"
echo "[backup] Source: ${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-password \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="${BACKUP_PATH}" 2>&1

BACKUP_SIZE="$(du -sh "${BACKUP_PATH}" | cut -f1)"
echo "[backup] Backup complete: ${BACKUP_PATH} (${BACKUP_SIZE})"

# ─── Upload to S3 (if credentials available) ──────────────────
if [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" && -n "${AWS_S3_BUCKET:-}" ]]; then
  S3_KEY="backups/postgres/${FILENAME}"
  S3_URI="s3://${AWS_S3_BUCKET}/${S3_KEY}"

  echo "[backup] Uploading to S3: ${S3_URI}"

  aws s3 cp \
    "${BACKUP_PATH}" \
    "${S3_URI}" \
    --region="${AWS_REGION:-eu-central-1}" \
    --storage-class=STANDARD_IA \
    --no-progress

  echo "[backup] S3 upload complete: ${S3_URI}"

  # Optionally remove local copy after successful S3 upload
  if [[ "${DELETE_LOCAL_AFTER_S3:-false}" == "true" ]]; then
    rm -f "${BACKUP_PATH}"
    echo "[backup] Local backup removed (uploaded to S3)"
  fi
else
  echo "[backup] AWS credentials not set — skipping S3 upload"
fi

# ─── Retention: delete old local backups ──────────────────────
echo "[backup] Cleaning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}"
DELETED_COUNT=0

while IFS= read -r -d '' OLD_FILE; do
  echo "[backup] Deleting old backup: ${OLD_FILE}"
  rm -f "${OLD_FILE}"
  DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "${BACKUP_DIR}" \
  -name "mylo_master_*.sql.gz" \
  -mtime "+${RETENTION_DAYS}" \
  -print0)

echo "[backup] Deleted ${DELETED_COUNT} old backup(s)"

# ─── Summary ───────────────────────────────────────────────────
echo "[backup] Done at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
