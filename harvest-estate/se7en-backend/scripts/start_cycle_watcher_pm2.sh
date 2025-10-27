#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pm2 start scripts/cycle_watcher_worker.ts \
  --name cycle-watcher \
  --interpreter npx \
  --interpreter-args "tsx -r dotenv/config" \
  --cwd "$DIR" \
  --update-env

pm2 save
