#!/usr/bin/env bash

set -euo pipefail

PORT=3050

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required to find processes using port $PORT" >&2
  exit 1
fi

find_pids() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

PIDS="$(find_pids)"

if [ -z "$PIDS" ]; then
  echo "No process is listening on port $PORT."
  exit 0
fi

echo "$PIDS" | while IFS= read -r pid; do
  [ -n "$pid" ] || continue
  name="$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")"
  echo "Stopping PID $pid ($name) listening on port $PORT..."
  kill "$pid" 2>/dev/null || true
done

sleep 1

REMAINING_PIDS="$(find_pids)"

if [ -n "$REMAINING_PIDS" ]; then
  echo "$REMAINING_PIDS" | while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    name="$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")"
    echo "Force stopping PID $pid ($name) listening on port $PORT..."
    kill -9 "$pid" 2>/dev/null || true
  done
fi

if [ -n "$(find_pids)" ]; then
  echo "Port $PORT is still in use." >&2
  exit 1
fi

echo "Port $PORT is free."
