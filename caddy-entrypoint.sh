#!/bin/sh
# Caddyfile placeholder {$VAR:default} подставляет default, только если
# переменная окружения НЕ задана вообще — а не если она задана пустой
# строкой (Docker Compose всегда передаёт DOMAIN как заданную переменную,
# даже пустую). Поэтому решаем это на уровне shell (POSIX ${VAR:-default}
# явно учитывает и unset, и пустую строку) до запуска caddy.
set -e
export ADDR="${DOMAIN:-:80}"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
