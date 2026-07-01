#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$ROOT_DIR/.omniharness"
LOG_FILE="$STATE_DIR/controller.log"
CURRENT_USER="${SUDO_USER:-$(id -un)}"
CURRENT_UID="$(id -u "$CURRENT_USER")"
TARGET_HOME="$(eval "printf '%s' ~${CURRENT_USER}" 2>/dev/null || true)"
if [[ -z "$TARGET_HOME" || "$TARGET_HOME" == "~"* ]]; then
  TARGET_HOME="$HOME"
fi
PLIST_DIR="/Library/LaunchDaemons"
LEGACY_PLIST="$TARGET_HOME/Library/LaunchAgents/dev.omniharness.restart-controller.plist"
PLIST="$PLIST_DIR/dev.omniharness.restart-controller.plist"
LABEL="dev.omniharness.restart-controller"
PORT="${OMNIHARNESS_REMOTE_RESTART_PORT:-3099}"
NEEDS_SUDO=0
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  NEEDS_SUDO=1
fi

run_as_root() {
  if [[ "$NEEDS_SUDO" -eq 1 ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

launchctl_cmd() {
  if [[ "$NEEDS_SUDO" -eq 1 ]]; then
    sudo launchctl "$@"
  else
    launchctl "$@"
  fi
}

unload_service() {
  local service="$1"

  if launchctl_cmd print "$service" >/dev/null 2>&1; then
    launchctl_cmd bootout "$service" >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      launchctl_cmd print "$service" >/dev/null 2>&1 || break
      sleep 0.25
    done
  fi
}

cd "$ROOT_DIR"
run_as_root mkdir -p "$STATE_DIR" "$PLIST_DIR"

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

TMP_PLIST="$(mktemp "$STATE_DIR/controller.plist.XXXXXX")"
trap 'rm -f "$TMP_PLIST"' EXIT

cat >"$TMP_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>UserName</key>
  <string>$CURRENT_USER</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"; cd "$ROOT_DIR" &amp;&amp; if [ -f .env ]; then set -a; source .env; set +a; fi; exec "$ROOT_DIR/node_modules/.bin/tsx" "$ROOT_DIR/scripts/remote-restart.ts"</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>$TARGET_HOME</string>
  </dict>
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

run_as_root install -m 644 "$TMP_PLIST" "$PLIST"
unload_service "gui/$CURRENT_UID/$LABEL"
rm -f "$LEGACY_PLIST"

unload_service "system/$LABEL"
launchctl_cmd bootstrap system "$PLIST"
launchctl_cmd kickstart -k "system/$LABEL"

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
