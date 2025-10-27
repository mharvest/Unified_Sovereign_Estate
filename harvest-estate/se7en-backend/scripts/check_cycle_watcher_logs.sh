#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$DIR/var/logs/cycle_watcher.log"
THRESHOLD_SECONDS=${1:-3600}
if [ ! -f "$LOG_FILE" ]; then
  echo "cycle watcher log missing at $LOG_FILE" >&2
  exit 2
fi
last_line=$(grep '\[' "$LOG_FILE" | tail -n 1 || true)
if [ -z "$last_line" ]; then
  echo "cycle watcher log has no timestamped entries" >&2
  exit 2
fi
last_timestamp=$(echo "$last_line" | sed -E 's/^\[([^]]+)\].*/\1/')
if [ -z "$last_timestamp" ]; then
  echo "unable to parse timestamp from: $last_line" >&2
  exit 2
fi
epoch_last=$(python3 - <<'PY'
import sys, datetime
try:
    value = datetime.datetime.fromisoformat(sys.argv[1].replace('Z', '+00:00'))
except ValueError:
    sys.exit(1)
print(int(value.timestamp()))
PY
"$last_timestamp" || true)
if [ -z "$epoch_last" ]; then
  echo "failed to convert timestamp: $last_timestamp" >&2
  exit 2
fi
epoch_now=$(date +%s)
delta=$(( epoch_now - epoch_last ))
if [ "$delta" -gt "$THRESHOLD_SECONDS" ]; then
  echo "cycle watcher stale: last tick ${delta}s ago" >&2
  exit 1
fi
echo "cycle watcher healthy: last tick ${delta}s ago"
exit 0
