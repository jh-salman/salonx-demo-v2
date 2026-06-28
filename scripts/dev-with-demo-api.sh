#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="$ROOT/salonx-web-v2"
API="$ROOT/demo-api"

if ! lsof -iTCP:4000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[dev-with-demo-api] Starting demo-api on :4000…"
  (cd "$API" && npm run dev) &
  API_PID=$!
  trap 'kill "$API_PID" 2>/dev/null || true' EXIT

  for _ in $(seq 1 30); do
    if curl -sf 'http://localhost:4000/api/config?forWeb=1' >/dev/null 2>&1; then
      echo "[dev-with-demo-api] demo-api ready."
      break
    fi
    sleep 0.5
  done
else
  echo "[dev-with-demo-api] demo-api already listening on :4000."
fi

cd "$WEB"
export VITE_DEV_USE_DEMO_API=true
exec npm run dev
