#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$ROOT_DIR/.omniharness"
LOG_FILE="$STATE_DIR/controller.log"
PLIST="$HOME/Library/LaunchAgents/dev.omniharness.restart-controller.plist"
LABEL="dev.omniharness.restart-controller"
PORT="${OMNIHARNESS_REMOTE_RESTART_PORT:-3099}"

cd "$ROOT_DIR"
mkdir -p "$STATE_DIR" "$(dirname "$PLIST")"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi
PORT="${OMNIHARNESS_REMOTE_RESTART_PORT:-$PORT}"

if [ ! -x "$ROOT_DIR/node_modules/.bin/tsx" ]; then
  echo "Missing node_modules/.bin/tsx. Run pnpm install, then retry." >&2
  exit 1
fi

cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"; cd "$ROOT_DIR" &amp;&amp; if [ -f .env ]; then set -a; source .env; set +a; fi; exec "$ROOT_DIR/node_modules/.bin/tsx" "$ROOT_DIR/scripts/remote-restart.ts"</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "Restart controller is running."
    echo "Open http://localhost:$PORT"
    echo "Logs: $LOG_FILE"
    exit 0
  fi
  sleep 0.5
done

echo "Restart controller launchd service was started, but health did not respond yet." >&2
echo "Check logs: $LOG_FILE" >&2
exit 1
