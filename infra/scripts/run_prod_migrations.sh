#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env.prod}"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-$BACKEND_DIR/.env.prod.local}"
ALEMBIC_BIN="${ALEMBIC_BIN:-$BACKEND_DIR/.venv-prod/bin/alembic}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

ALEMBIC_ARGS=("$@")
if [ ${#ALEMBIC_ARGS[@]} -eq 0 ]; then
  ALEMBIC_ARGS=(-c alembic.ini upgrade head)
fi

BACKEND_DIR="$BACKEND_DIR" ENV_FILE="$ENV_FILE" LOCAL_ENV_FILE="$LOCAL_ENV_FILE" ALEMBIC_BIN="$ALEMBIC_BIN" python3 - "${ALEMBIC_ARGS[@]}" <<'PY'
import os
import sys
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        os.environ[key] = value


backend_dir = Path(os.environ["BACKEND_DIR"])
env_file = Path(os.environ["ENV_FILE"])
local_env_file = Path(os.environ["LOCAL_ENV_FILE"])
alembic_bin = Path(os.environ["ALEMBIC_BIN"])

if not alembic_bin.exists():
    print(f"Alembic executable not found: {alembic_bin}", file=sys.stderr)
    raise SystemExit(1)

load_env_file(env_file)
load_env_file(local_env_file)

if os.environ.get("DB_PASS") in ("", None, "PUT_DATABASE_PASSWORD_HERE"):
    print(f"Set DB_PASS in {local_env_file} before running production migrations.", file=sys.stderr)
    raise SystemExit(1)

os.chdir(backend_dir)
os.execvpe(str(alembic_bin), [str(alembic_bin), *sys.argv[1:]], os.environ)
PY
