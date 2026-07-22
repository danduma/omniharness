#!/bin/sh
set -eu

archive_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
archive_port=${CODEX_HISTORY_PORT:-49321}
cd "$archive_dir"

python3 -m http.server "$archive_port" --bind 127.0.0.1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM

if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:${archive_port}/"
fi

wait "$server_pid"

