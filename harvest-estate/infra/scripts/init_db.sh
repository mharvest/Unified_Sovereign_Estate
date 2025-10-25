#!/usr/bin/env bash
set -euo pipefail

cd /app/se7en-backend

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but not available" >&2
  exit 1
fi

echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Database initialized."
