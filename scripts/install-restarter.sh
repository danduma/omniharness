#!/usr/bin/env bash
#
# install-restarter.sh — install the omniharness restart-control service as a
# macOS launchd job. By default this is a LaunchDaemon so it starts after reboot
# even if the Mac does not auto-login. Pass OMNIHARNESS_RESTART_LAUNCHD_SCOPE=user
# if you explicitly want the older login-session LaunchAgent behavior.
#
# The service listens on OMNIHARNESS_REMOTE_RESTART_PORT (default 3099) and lets
# you remotely restart the app (typically exposed via a cloudflared tunnel).
#
# Usage:
#   ./scripts/install-restarter.sh            # install + start
#   ./scripts/install-restarter.sh uninstall  # stop + remove
#
# Honors OMNIHARNESS_REMOTE_RESTART_PORT to pin a non-default port.
# Honors OMNIHARNESS_RESTART_LAUNCHD_SCOPE=user|system to override the launchd
# scope. The default is system.
# Honors OMNIHARNESS_RESTART_LAUNCHD_DIR to override the plist directory.

set -euo pipefail

LABEL="com.omniharness.restart-control"
PORT="${OMNIHARNESS_REMOTE_RESTART_PORT:-3099}"
LAUNCHD_SCOPE="${OMNIHARNESS_RESTART_LAUNCHD_SCOPE:-system}"
CURRENT_USER="${SUDO_USER:-$(id -un)}"
CURRENT_UID="$(id -u "$CURRENT_USER")"
TARGET_HOME="$(eval "printf '%s' ~${CURRENT_USER}" 2>/dev/null || true)"
if [[ -z "$TARGET_HOME" || "$TARGET_HOME" == "~"* ]]; then
  TARGET_HOME="$HOME"
fi
USER_PLIST_DIR="$TARGET_HOME/Library/LaunchAgents"
SYSTEM_PLIST_DIR="/Library/LaunchDaemons"

case "$LAUNCHD_SCOPE" in
  system)
    PLIST_DIR="${OMNIHARNESS_RESTART_LAUNCHD_DIR:-$SYSTEM_PLIST_DIR}"
    LAUNCHD_DOMAIN="system"
    LEGACY_DOMAIN="gui/${CURRENT_UID}"
    LEGACY_PLIST="$USER_PLIST_DIR/${LABEL}.plist"
    ;;
  user)
    PLIST_DIR="${OMNIHARNESS_RESTART_LAUNCHD_DIR:-$USER_PLIST_DIR}"
    LAUNCHD_DOMAIN="gui/${CURRENT_UID}"
    LEGACY_DOMAIN=""
    LEGACY_PLIST=""
    ;;
  *)
    echo "[install-restarter] ERROR: OMNIHARNESS_RESTART_LAUNCHD_SCOPE must be 'system' or 'user'." >&2
    exit 1
    ;;
esac

PLIST="${PLIST_DIR}/${LABEL}.plist"
NEEDS_SUDO=0
if [[ "$LAUNCHD_SCOPE" == "system" && "$PLIST_DIR" == "$SYSTEM_PLIST_DIR" && "${EUID:-$(id -u)}" -ne 0 ]]; then
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

# Repo root = parent of this script's directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

unload() {
  local target_domain="$1"

  if launchctl_cmd print "${target_domain}/${LABEL}" >/dev/null 2>&1; then
    launchctl_cmd bootout "${target_domain}/${LABEL}" 2>/dev/null || true
    # bootout is asynchronous — wait until the label is actually gone so a
    # subsequent bootstrap doesn't race it (launchd error 5: I/O error).
    for _ in $(seq 1 20); do
      launchctl_cmd print "${target_domain}/${LABEL}" >/dev/null 2>&1 || break
      sleep 0.25
    done
  fi
}

unload_legacy_agent() {
  if [[ -z "${LEGACY_DOMAIN:-}" || -z "${LEGACY_PLIST:-}" ]]; then
    return
  fi

  if launchctl_cmd print "${LEGACY_DOMAIN}/${LABEL}" >/dev/null 2>&1; then
    launchctl_cmd bootout "${LEGACY_DOMAIN}/${LABEL}" 2>/dev/null || true
    for _ in $(seq 1 20); do
      launchctl_cmd print "${LEGACY_DOMAIN}/${LABEL}" >/dev/null 2>&1 || break
      sleep 0.25
    done
  fi

  rm -f "$LEGACY_PLIST"
}

if [[ "${1:-}" == "uninstall" || "${1:-}" == "remove" ]]; then
  echo "[install-restarter] Stopping and removing ${LABEL}…"
  unload "$LAUNCHD_DOMAIN"
  if [[ "$LAUNCHD_SCOPE" == "system" ]]; then
    unload_legacy_agent
  fi
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
USER_NAME_BLOCK=""
if [[ "$LAUNCHD_SCOPE" == "system" ]]; then
  USER_NAME_BLOCK="    <key>UserName</key>
    <string>${CURRENT_USER}</string>"
fi

if [[ "$LAUNCHD_SCOPE" == "system" ]]; then
  unload_legacy_agent
fi

run_as_root mkdir -p "$PLIST_DIR"
mkdir -p "$REPO_ROOT/.omniharness"

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

${USER_NAME_BLOCK}

    <key>WorkingDirectory</key>
    <string>${REPO_ROOT}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${AGENT_PATH}</string>
        <key>HOME</key>
        <string>${TARGET_HOME}</string>
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
unload "$LAUNCHD_DOMAIN"
echo "[install-restarter] Loading agent…"
launchctl_cmd bootstrap "$LAUNCHD_DOMAIN" "$PLIST"

# Brief health check.
sleep 3
if launchctl_cmd print "${LAUNCHD_DOMAIN}/${LABEL}" 2>/dev/null | grep -q "state = running"; then
  echo "[install-restarter] ✓ Running. restart-control listening on http://0.0.0.0:${PORT}"
  echo "[install-restarter]   Logs: ${REPO_ROOT}/.omniharness/restart-control.out.log"
  echo "[install-restarter]   Tunnel target: http://localhost:${PORT}"
else
  echo "[install-restarter] ⚠ Agent loaded but not yet 'running' — check logs:" >&2
  echo "[install-restarter]   ${REPO_ROOT}/.omniharness/restart-control.err.log" >&2
  exit 1
fi
