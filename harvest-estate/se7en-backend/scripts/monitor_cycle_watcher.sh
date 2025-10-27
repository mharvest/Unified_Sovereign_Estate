#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_CHECK="$DIR/scripts/check_cycle_watcher_logs.sh"
PM2_CHECK="$DIR/scripts/check_cycle_watcher_pm2.sh"

status=0

if [ -x "$LOG_CHECK" ]; then
  "$LOG_CHECK" "$@" || status=$?
else
  echo "log check script missing or not executable" >&2
  status=2
fi

if [ -x "$PM2_CHECK" ]; then
  "$PM2_CHECK" || status=$?
else
  echo "pm2 check script missing or not executable" >&2
  status=2
fi

exit $status
