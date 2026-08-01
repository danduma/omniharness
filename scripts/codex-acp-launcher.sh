#!/bin/sh

set -eu

if [ -n "${OMNIHARNESS_CODEX_ACP_NPM_ROOT:-}" ]; then
  install_root="$OMNIHARNESS_CODEX_ACP_NPM_ROOT"
elif [ -n "${HOME:-}" ]; then
  install_root="$HOME/.local/share/omniharness/codex-acp"
else
  echo "codex-acp requires HOME or OMNIHARNESS_CODEX_ACP_NPM_ROOT." >&2
  exit 127
fi

adapter="$install_root/node_modules/@agentclientprotocol/codex-acp/dist/index.js"
current_codex="$install_root/node_modules/.bin/codex"

if [ ! -f "$adapter" ]; then
  echo "codex-acp is not installed at $install_root; run pnpm setup:agents" >&2
  exit 127
fi

# The adapter accepts an explicit Codex executable. Keeping this as a separate,
# rolling npm dependency lets OmniHarness pick up new model metadata as soon as
# Codex ships it, without waiting for a new ACP adapter release.
if [ -z "${CODEX_PATH:-}" ] && [ -x "$current_codex" ]; then
  export CODEX_PATH="$current_codex"
fi

exec node "$adapter" "$@"
