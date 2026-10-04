#!/usr/bin/env bash
set -euo pipefail

if [ -z "${REMOTE_BACKUP_TARGET:-}" ]; then
  echo "Set REMOTE_BACKUP_TARGET, for example: user@backup-server:/backups/brickfarm/postgres/" >&2
  exit 2
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/bitnami/backups/brickfarm/encrypted}"
latest="$(find "$BACKUP_DIR" -type f -name 'brickfarm-*.sql.gz.enc' -printf '%T@ %p\n' | sort -nr | awk 'NR==1 {print $2}')"
if [ -z "$latest" ]; then
  echo "No encrypted backup found in $BACKUP_DIR" >&2
  exit 1
fi

if command -v rsync >/dev/null 2>&1; then
  rsync -av --protect-args "$latest" "$latest.sha256" "$REMOTE_BACKUP_TARGET"
else
  scp "$latest" "$latest.sha256" "$REMOTE_BACKUP_TARGET"
fi

echo "Synced $(basename "$latest") to $REMOTE_BACKUP_TARGET"
