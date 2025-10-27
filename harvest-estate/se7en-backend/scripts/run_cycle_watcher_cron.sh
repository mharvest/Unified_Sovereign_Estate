#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$DIR/var/logs"
LOG_FILE="$LOG_DIR/cycle_watcher.log"

mkdir -p "$LOG_DIR"

if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] cycle watcher tick" >> "$LOG_FILE"
cd "$DIR"
make cycle-watcher >> "$LOG_FILE" 2>&1
