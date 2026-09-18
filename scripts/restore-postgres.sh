#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/siberiangym}"
S3_PREFIX="${BACKUP_S3_PREFIX:-backups/postgres}"
AWS_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:2}"

usage() {
  printf 'Usage: %s <backup-file|s3://bucket/key> [restore-compose-file]\n' "$0" >&2
  printf 'The restore target must be a disposable PostgreSQL environment.\n' >&2
  exit 2
}

[[ $# -ge 1 && $# -le 2 ]] || usage
SOURCE="$1"
RESTORE_COMPOSE_FILE="${2:-$COMPOSE_FILE}"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Environment file not found: %s\n' "$ENV_FILE" >&2
  exit 1
fi

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

S3_ENDPOINT="$(read_env S3_ENDPOINT)"
S3_REGION="$(read_env S3_REGION)"
S3_BUCKET="$(read_env S3_BUCKET)"
S3_ACCESS_KEY_ID="$(read_env S3_ACCESS_KEY_ID)"
S3_SECRET_ACCESS_KEY="$(read_env S3_SECRET_ACCESS_KEY)"

if [[ "$SOURCE" == s3://* ]]; then
  FILE_NAME="$(basename "$SOURCE")"
  LOCAL_PATH="$BACKUP_DIR/$FILE_NAME"
  mkdir -p "$BACKUP_DIR"
  [[ -n "$S3_ENDPOINT" && -n "$S3_ACCESS_KEY_ID" && -n "$S3_SECRET_ACCESS_KEY" ]] || {
    printf 'S3 credentials are required for an s3:// source.\n' >&2
    exit 1
  }
  docker run --rm \
    -v "$BACKUP_DIR:/backup" \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    "$AWS_IMAGE" s3 cp "$SOURCE" "/backup/$FILE_NAME" \
    --endpoint-url "$S3_ENDPOINT" --region "${S3_REGION:-ru-1}"
else
  LOCAL_PATH="$SOURCE"
  [[ -f "$LOCAL_PATH" ]] || LOCAL_PATH="$BACKUP_DIR/$SOURCE"
fi

[[ -s "$LOCAL_PATH" ]] || {
  printf 'Backup file not found or empty: %s\n' "$LOCAL_PATH" >&2
  exit 1
}

printf 'WARNING: this restores into the PostgreSQL service from %s.\n' "$RESTORE_COMPOSE_FILE" >&2
printf 'The target must be disposable; existing data in the target database is overwritten.\n' >&2
read -r -p 'Type RESTORE to continue: ' CONFIRM
[[ "$CONFIRM" == 'RESTORE' ]] || {
  printf 'Restore cancelled.\n' >&2
  exit 1
}

docker compose -f "$RESTORE_COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  dropdb -U siberiangym --if-exists siberiangym
docker compose -f "$RESTORE_COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  createdb -U siberiangym siberiangym
docker compose -f "$RESTORE_COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_restore -U siberiangym -d siberiangym --clean --if-exists --no-owner --exit-on-error < "$LOCAL_PATH"

docker compose -f "$RESTORE_COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U siberiangym -d siberiangym -v ON_ERROR_STOP=1 -c 'SELECT current_database(), count(*) AS applied_migrations FROM "_prisma_migrations";'
printf 'Restore completed: %s\n' "$LOCAL_PATH"
