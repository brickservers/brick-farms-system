#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/bitnami/backups/brickfarm/postgres}"
OUT_DIR="${OUT_DIR:-/opt/bitnami/backups/brickfarm/encrypted}"

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "Set BACKUP_PASSPHRASE before running this script." >&2
  exit 2
fi

latest="$(find "$BACKUP_DIR" -type f -name 'brickfarm-*.sql.gz' -printf '%T@ %p\n' | sort -nr | awk 'NR==1 {print $2}')"
if [ -z "$latest" ]; then
  echo "No backup found in $BACKUP_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
base="$(basename "$latest")"
encrypted="$OUT_DIR/$base.enc"

openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass "env:BACKUP_PASSPHRASE" \
  -in "$latest" \
  -out "$encrypted"

sha256sum "$encrypted" > "$encrypted.sha256"
echo "$encrypted"
