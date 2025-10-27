#!/usr/bin/env bash
set -euo pipefail
if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not installed" >&2
  exit 2
fi
status_json=$(pm2 jlist 2>/dev/null || true)
if [ -z "$status_json" ]; then
  echo "pm2 returned empty process list" >&2
  exit 2
fi
result=$(node - <<'NODE'
const data = JSON.parse(process.argv[1]);
const proc = data.find((p) => p.name === 'cycle-watcher');
if (!proc) {
  console.log('missing');
  process.exit(0);
}
console.log(proc.pm2_env?.status || 'unknown');
NODE
"$status_json")
if [ "$result" = "missing" ]; then
  echo "cycle-watcher not registered in pm2" >&2
  exit 2
fi
if [ "$result" != "online" ]; then
  echo "cycle-watcher status $result" >&2
  exit 1
fi
echo "cycle-watcher status online"
exit 0
