#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="${OMNI_INSTALL_DIR:-$HOME/.local/bin}"

omni_script="$ROOT_DIR/omni"
omni_link="$INSTALL_DIR/omni"

if [ ! -f "$omni_script" ]; then
  echo "Error: $omni_script not found." >&2
  exit 1
fi

chmod +x "$omni_script"

mkdir -p "$INSTALL_DIR"

if [ -L "$omni_link" ]; then
  current_target="$(readlink "$omni_link")"
  if [ "$current_target" = "$omni_script" ]; then
    echo "omni is already set up at $omni_link -> $omni_script"
    exit 0
  fi
  echo "Updating existing symlink: $omni_link -> $current_target"
fi

ln -sf "$omni_script" "$omni_link"
echo "Installed: $omni_link -> $omni_script"

if ! command -v omni >/dev/null 2>&1; then
  echo ""
  echo "Note: $INSTALL_DIR is not on your PATH."
  echo "Add this to your shell config:"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
fi
