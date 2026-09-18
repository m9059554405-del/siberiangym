#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
DISK_PATH="${MONITOR_DISK_PATH:-/}"
DISK_MIN_FREE_PERCENT="${MONITOR_MIN_FREE_PERCENT:-15}"
HEALTH_URL="${MONITOR_HEALTH_URL:-http://127.0.0.1/api/health}"
STATE_DIR="${MONITOR_STATE_DIR:-/var/lib/siberiangym-monitor}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

mkdir -p "$STATE_DIR"

send_alert() {
  local message="$1"
  local fingerprint
  fingerprint="$(printf '%s' "$message" | sha256sum | cut -d' ' -f1)"
  local state_file="$STATE_DIR/$fingerprint"
  if [[ -f "$state_file" ]]; then return; fi
  touch "$state_file"
  printf '%s\n' "$message" >&2
  if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    curl --fail --silent --show-error -X POST --data-urlencode "text=$message" "$ALERT_WEBHOOK_URL" >/dev/null || true
  fi
}

clear_alerts() {
  local prefix="$1"
  find "$STATE_DIR" -type f -name "$prefix*" -delete 2>/dev/null || true
}

if ! curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" >/dev/null; then
  send_alert "SiberianGym: health endpoint недоступен: $HEALTH_URL"
else
  clear_alerts "$(printf '%s' "SiberianGym: health endpoint недоступен: $HEALTH_URL" | sha256sum | cut -d' ' -f1)"
fi

if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --status running --services | grep -qx 'api'; then
  send_alert "SiberianGym: контейнер API не находится в состоянии running"
fi

free_percent="$(df -P "$DISK_PATH" | awk 'NR==2 {gsub(/%/, "", $5); print 100 - $5}')"
if [[ -z "$free_percent" || "$free_percent" -lt "$DISK_MIN_FREE_PERCENT" ]]; then
  send_alert "SiberianGym: свободное место на $DISK_PATH ниже порога ${DISK_MIN_FREE_PERCENT}% (сейчас ${free_percent:-unknown}%)"
fi
