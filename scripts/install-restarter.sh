#!/usr/bin/env bash
#
# install-restarter.sh — install the omniharness restart-control service as a
# macOS launchd LaunchAgent so it auto-starts at login and restarts on crash.
#
# The service listens on OMNIHARNESS_REMOTE_RESTART_PORT (default 3099) and lets
# you remotely restart the app (typically exposed via a cloudflared tunnel).
#
# Usage:
#   ./scripts/install-restarter.sh            # install + start
#   ./scripts/install-restarter.sh uninstall  # stop + remove
#
# Honors OMNIHARNESS_REMOTE_RESTART_PORT to pin a non-default port.

set -euo pipefail

LABEL="com.omniharness.restart-control"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
PORT="${OMNIHARNESS_REMOTE_RESTART_PORT:-3099}"

# Repo root = parent of this script's directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

uid="$(id -u)"
domain="gui/${uid}"

unload() {
  if launchctl print "${domain}/${LABEL}" >/dev/null 2>&1; then
    launchctl bootout "${domain}/${LABEL}" 2>/dev/null || true
    # bootout is asynchronous — wait until the label is actually gone so a
    # subsequent bootstrap doesn't race it (launchd error 5: I/O error).
    for _ in $(seq 1 20); do
      launchctl print "${domain}/${LABEL}" >/dev/null 2>&1 || break
      sleep 0.25
    done
  fi
}

if [[ "${1:-}" == "uninstall" || "${1:-}" == "remove" ]]; then
  echo "[install-restarter] Stopping and removing ${LABEL}…"
  unload
  rm -f "$PLIST"
  echo "[install-restarter] Removed $PLIST"
  exit 0
fi

# Resolve toolchain absolute paths — launchd agents do not inherit your shell PATH.
PNPM_BIN="$(command -v pnpm || true)"
NODE_BIN="$(command -v node || true)"
if [[ -z "$PNPM_BIN" ]]; then
  echo "[install-restarter] ERROR: pnpm not found on PATH." >&2
  exit 1
fi
if [[ -z "$NODE_BIN" ]]; then
  echo "[install-restarter] ERROR: node not found on PATH." >&2
  exit 1
fi
NODE_DIR="$(dirname "$NODE_BIN")"

# Build a PATH that includes the node (nvm) bin dir plus common locations.
AGENT_PATH="${NODE_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$HOME/Library/LaunchAgents" "$REPO_ROOT/.omniharness"

echo "[install-restarter] Writing $PLIST (port ${PORT})…"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <!-- Source .env first so the restart-control web UI accepts the OmniHarness
         password (OMNIHARNESS_AUTH_PASSWORD) and the app it spawns inherits the
         same env. remote-restart.ts itself does not load .env. -->
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd '${REPO_ROOT}'; set -a; [ -f .env ] &amp;&amp; . ./.env; set +a; exec '${PNPM_BIN}' run restart:control</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${REPO_ROOT}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${AGENT_PATH}</string>
        <key>OMNIHARNESS_REMOTE_RESTART_PORT</key>
        <string>${PORT}</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${REPO_ROOT}/.omniharness/restart-control.out.log</string>

    <key>StandardErrorPath</key>
    <string>${REPO_ROOT}/.omniharness/restart-control.err.log</string>
</dict>
</plist>
PLIST_EOF

# Reload cleanly (idempotent): bootout if already loaded, then bootstrap.
unload
echo "[install-restarter] Loading agent…"
launchctl bootstrap "$domain" "$PLIST"

# Brief health check.
sleep 3
if launchctl print "${domain}/${LABEL}" 2>/dev/null | grep -q "state = running"; then
  echo "[install-restarter] ✓ Running. restart-control listening on http://0.0.0.0:${PORT}"
  echo "[install-restarter]   Logs: ${REPO_ROOT}/.omniharness/restart-control.out.log"
  echo "[install-restarter]   Tunnel target: http://localhost:${PORT}"
else
  echo "[install-restarter] ⚠ Agent loaded but not yet 'running' — check logs:" >&2
  echo "[install-restarter]   ${REPO_ROOT}/.omniharness/restart-control.err.log" >&2
  exit 1
fi
