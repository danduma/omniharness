#!/usr/bin/env bash

set -euo pipefail

DEFAULT_PORTS=(3050 3035 7800)

if [ "$#" -gt 0 ]; then
  PORTS=("$@")
else
  PORTS=("${DEFAULT_PORTS[@]}")
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required to find processes using ports ${PORTS[*]}" >&2
  exit 1
fi

find_pids() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

cleanup_runtime_lock() {
  local port="$1"
  local lock_path=".omniharness/bridge.lock.json"

  if [ "$port" != "7800" ] || [ ! -f "$lock_path" ]; then
    return
  fi

  echo "Removing stale OmniHarness agent runtime lock at $lock_path..."
  rm -f "$lock_path"
}

for PORT in "${PORTS[@]}"; do
  if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "Invalid port: $PORT" >&2
    exit 1
  fi

  PIDS="$(find_pids "$PORT")"

  if [ -z "$PIDS" ]; then
    echo "No process is listening on port $PORT."
    cleanup_runtime_lock "$PORT"
    continue
  fi

  echo "$PIDS" | while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    name="$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")"
    echo "Stopping PID $pid ($name) listening on port $PORT..."
    kill "$pid" 2>/dev/null || true
  done

  sleep 1

  REMAINING_PIDS="$(find_pids "$PORT")"

  if [ -n "$REMAINING_PIDS" ]; then
    echo "$REMAINING_PIDS" | while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      name="$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")"
      echo "Force stopping PID $pid ($name) listening on port $PORT..."
      kill -9 "$pid" 2>/dev/null || true
    done
  fi

  if [ -n "$(find_pids "$PORT")" ]; then
    echo "Port $PORT is still in use." >&2
    exit 1
  fi

  cleanup_runtime_lock "$PORT"
  echo "Port $PORT is free."
done
