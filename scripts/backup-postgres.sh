#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/siberiangym}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_PREFIX="${BACKUP_S3_PREFIX:-backups/postgres}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-siberiangym-prod}"
AWS_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:2}"

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

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE_NAME="siberiangym-${STAMP}.dump"
FILE_PATH="$BACKUP_DIR/$FILE_NAME"

cleanup() {
  rm -f "$FILE_PATH.tmp"
}
trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U siberiangym -Fc -Z 6 siberiangym > "$FILE_PATH.tmp"
test -s "$FILE_PATH.tmp"
mv "$FILE_PATH.tmp" "$FILE_PATH"

if [[ -n "$S3_ENDPOINT" && -n "$S3_BUCKET" && -n "$S3_ACCESS_KEY_ID" && -n "$S3_SECRET_ACCESS_KEY" ]]; then
  docker run --rm \
    -v "$BACKUP_DIR:/backup:ro" \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    "$AWS_IMAGE" s3 cp "/backup/$FILE_NAME" "s3://$S3_BUCKET/$S3_PREFIX/$FILE_NAME" \
    --endpoint-url "$S3_ENDPOINT" --region "${S3_REGION:-ru-1}"

  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    "$AWS_IMAGE" s3api put-bucket-lifecycle-configuration \
    --bucket "$S3_BUCKET" \
    --endpoint-url "$S3_ENDPOINT" --region "${S3_REGION:-ru-1}" \
    --lifecycle-configuration "{\"Rules\":[{\"ID\":\"siberiangym-postgres-retention\",\"Status\":\"Enabled\",\"Filter\":{\"Prefix\":\"$S3_PREFIX/\"},\"Expiration\":{\"Days\":$RETENTION_DAYS}}]}"
else
  printf 'S3 backup is not configured; keeping local backup only: %s\n' "$FILE_PATH" >&2
fi

find "$BACKUP_DIR" -type f -name 'siberiangym-*.dump' -mtime "+$RETENTION_DAYS" -delete
printf 'Backup created: %s\n' "$FILE_PATH"
