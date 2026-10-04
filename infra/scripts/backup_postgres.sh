#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/bitnami/backups/brickfarm/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/brickfarm-$STAMP.sql.gz"
ENV_FILE="${ENV_FILE:-/opt/bitnami/apache2/htdocs/farm/backend/.env.prod}"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-/opt/bitnami/apache2/htdocs/farm/backend/.env.prod.local}"

mkdir -p "$BACKUP_DIR"

if [ -f "$ENV_FILE" ]; then
  eval "$(ENV_FILE="$ENV_FILE" python3 - <<'PY'
import os
import shlex
from pathlib import Path

for raw_line in Path(os.environ["ENV_FILE"]).read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1]
    print(f"export {key}={shlex.quote(value)}")
PY
)"
fi
if [ -f "$LOCAL_ENV_FILE" ]; then
  eval "$(ENV_FILE="$LOCAL_ENV_FILE" python3 - <<'PY'
import os
import shlex
from pathlib import Path

for raw_line in Path(os.environ["ENV_FILE"]).read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1]
    print(f"export {key}={shlex.quote(value)}")
PY
)"
fi

if command -v pg_dump >/dev/null 2>&1; then
  : "${DB_HOST:=127.0.0.1}"
  : "${DB_PORT:=5433}"
  : "${DB_NAME:=brickfarm}"
  : "${DB_USER:=brickfarm}"
  : "${DB_PASS:=brickfarm_pass}"
  PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=plain --no-owner --no-acl | gzip -9 > "$OUT"
elif command -v docker >/dev/null 2>&1 && sudo docker inspect brickfarm-db >/dev/null 2>&1; then
  sudo docker exec brickfarm-db pg_dump -U brickfarm -d brickfarm --format=plain --no-owner --no-acl | gzip -9 > "$OUT"
else
  echo "pg_dump not found and brickfarm-db container not available" >&2
  exit 1
fi

find "$BACKUP_DIR" -type f -name 'brickfarm-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "$OUT"
