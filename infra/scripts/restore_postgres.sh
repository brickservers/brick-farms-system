#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 /path/to/brickfarm-YYYYMMDDTHHMMSSZ.sql.gz" >&2
  exit 2
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

ENV_FILE="${ENV_FILE:-/opt/bitnami/apache2/htdocs/farm/backend/.env.prod}"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-/opt/bitnami/apache2/htdocs/farm/backend/.env.prod.local}"
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

: "${DB_NAME:=brickfarm}"
: "${DB_USER:=brickfarm}"

echo "Restoring $BACKUP_FILE into database $DB_NAME as $DB_USER"
echo "This will apply SQL from the backup to the target database."

if command -v psql >/dev/null 2>&1; then
  : "${DB_HOST:=127.0.0.1}"
  : "${DB_PORT:=5433}"
  : "${DB_PASS:=brickfarm_pass}"
  gzip -dc "$BACKUP_FILE" | PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
elif command -v docker >/dev/null 2>&1 && sudo docker inspect brickfarm-db >/dev/null 2>&1; then
  gzip -dc "$BACKUP_FILE" | sudo docker exec -i brickfarm-db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
else
  echo "psql not found and brickfarm-db container not available" >&2
  exit 1
fi

echo "Restore complete."
