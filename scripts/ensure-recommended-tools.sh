#!/usr/bin/env bash
set -euo pipefail

if [ "${OMNIHARNESS_SKIP_RECOMMENDED_TOOLS:-0}" = "1" ] || [ "${OMNIHARNESS_INSTALL_RECOMMENDED_TOOLS:-1}" = "0" ]; then
  echo "[omniharness] Skipping recommended tool setup."
  exit 0
fi

if command -v rg >/dev/null 2>&1; then
  echo "[omniharness] ripgrep detected."
  exit 0
fi

run_as_root() {
  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  return 1
}

install_with_known_package_manager() {
  if command -v brew >/dev/null 2>&1; then
    brew install ripgrep
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    run_as_root apt-get update
    run_as_root apt-get install -y ripgrep
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    run_as_root dnf install -y ripgrep
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    run_as_root yum install -y ripgrep
    return
  fi

  if command -v pacman >/dev/null 2>&1; then
    run_as_root pacman -Sy --needed --noconfirm ripgrep
    return
  fi

  if command -v zypper >/dev/null 2>&1; then
    run_as_root zypper --non-interactive install ripgrep
    return
  fi

  if command -v apk >/dev/null 2>&1; then
    run_as_root apk add ripgrep
    return
  fi

  return 1
}

echo "[omniharness] ripgrep (rg) is recommended for agent repository search."
echo "[omniharness] Attempting to install ripgrep with the system package manager..."

if install_with_known_package_manager && command -v rg >/dev/null 2>&1; then
  echo "[omniharness] ripgrep installed."
  exit 0
fi

echo "[omniharness] Could not install ripgrep automatically. Continuing without it."
echo "[omniharness] Recommended manual install:"
echo "  macOS: brew install ripgrep"
echo "  Debian/Ubuntu: sudo apt-get install ripgrep"
echo "  Fedora: sudo dnf install ripgrep"
