#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: scripts/install-agent-acp.sh [--dry-run]" >&2
      exit 1
      ;;
  esac
done

have_command() {
  command -v "$1" >/dev/null 2>&1
}

report_tool() {
  local tool_name="$1"
  local requirement="$2"

  if have_command "$tool_name"; then
    echo "  -> $tool_name: detected ($(command -v "$tool_name"))"
    return 0
  fi

  if [ "$requirement" = "required" ]; then
    echo "  -> $tool_name: missing (recommended for full agent capability)" >&2
  else
    echo "  -> $tool_name: missing (optional)" >&2
  fi
}

run_install_npm() {
  local package_name="$1"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  -> would install \`$package_name\` with \`npm install -g $package_name\`"
    return 0
  fi

  if ! have_command npm; then
    echo "  -> cannot install \`$package_name\`: npm is not on PATH" >&2
    return 1
  fi

  npm install -g "$package_name"
  echo "  -> installed \`$package_name\`"
}

run_install_cargo_git() {
  local binary_name="$1"
  local git_url="$2"
  local git_tag="$3"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  -> would install \`$binary_name\` with \`cargo install --locked --git $git_url --tag $git_tag $binary_name\`"
    return 0
  fi

  if ! have_command cargo; then
    echo "  -> cannot install \`$binary_name\`: cargo is not on PATH" >&2
    return 1
  fi

  cargo install --locked --git "$git_url" --tag "$git_tag" "$binary_name"
  echo "  -> installed \`$binary_name\`"
}

echo "Detecting local coding agents and ACP adapters..."

if have_command codex; then
  echo "codex: detected"
  if have_command codex-acp; then
    echo "  -> \`codex-acp\` already installed"
  else
    run_install_cargo_git "codex-acp" "https://github.com/cola-io/codex-acp.git" "v0.4.2"
  fi
else
  echo "codex: not detected"
fi

if have_command claude; then
  echo "claude: detected"
  if have_command claude-agent-acp; then
    echo "  -> \`claude-agent-acp\` already installed"
  else
    run_install_npm "@agentclientprotocol/claude-agent-acp"
  fi
else
  echo "claude: not detected"
fi

if have_command gemini; then
  echo "gemini: detected"
  echo "  -> native ACP support via \`gemini --experimental-acp\`; no separate adapter needed"
else
  echo "gemini: not detected"
fi

if have_command opencode; then
  echo "opencode: detected"
  echo "  -> native ACP support via \`opencode acp\`; no separate adapter needed"
else
  echo "opencode: not detected"
fi

echo ""
echo "Checking agent tool environment..."
echo "The OmniHarness agent runtime builds a managed worker PATH from common developer tool locations,"
echo "but installing these tools globally still gives agents the best local capability."
echo "Structured ACP filesystem tools are provided by the runtime: read_text_file, write_text_file, edit_text_file, multi_edit_text_file."
if [ "$(uname -s)" = "Linux" ]; then
  echo "Codex workers also get native Codex argv0 shims: apply_patch, applypatch, codex-linux-sandbox."
else
  echo "Codex workers also get native Codex argv0 shims: apply_patch, applypatch."
fi
echo "Codex core tools are enabled through a runtime managed config: exec_command, write_stdin, update_plan, apply_patch, web_search, view_image, MCP resources."
for tool in rg git node bash sh ls; do
  report_tool "$tool" "required"
done
for tool in pnpm npm python3 python zsh sed awk grep find xargs mkdir rm cp mv jq gh cargo uv fd make; do
  report_tool "$tool" "optional"
done

echo "Done."
