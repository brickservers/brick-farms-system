#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/backend/.env.prod.local}"
TEMPLATE_ENV_FILE="${TEMPLATE_ENV_FILE:-$ROOT_DIR/backend/.env.prod}"

if [ ! -f "$TEMPLATE_ENV_FILE" ]; then
  echo "Environment file not found: $TEMPLATE_ENV_FILE" >&2
  exit 1
fi

printf "PostgreSQL password for %s: " "${DB_USER:-brickfarm}"
stty -echo
IFS= read -r DB_PASSWORD
stty echo
printf "\n"

if [ -z "$DB_PASSWORD" ]; then
  echo "Password cannot be empty." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  printf "DB_PASS=PUT_DATABASE_PASSWORD_HERE\n" > "$ENV_FILE"
fi

DB_PASSWORD="$DB_PASSWORD" ENV_FILE="$ENV_FILE" python3 - <<'PY'
import os
from pathlib import Path

env_file = Path(os.environ["ENV_FILE"])
password = os.environ["DB_PASSWORD"]
lines = env_file.read_text().splitlines()

for index, line in enumerate(lines):
    if line.startswith("DB_PASS="):
        lines[index] = f"DB_PASS={password}"
        break
else:
    lines.append(f"DB_PASS={password}")

env_file.write_text("\n".join(lines) + "\n")
PY

chmod 600 "$ENV_FILE"
echo "Updated $ENV_FILE"
