#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=0
ENSURE_ONLY=0
CODEX_ACP_INSTALL_MODE="${OMNIHARNESS_CODEX_ACP_INSTALL:-auto}"
CODEX_ACP_RELEASE_REPO="${OMNIHARNESS_CODEX_ACP_RELEASE_REPO:-danduma/omniharness}"
CODEX_ACP_RELEASE_TAG="${OMNIHARNESS_CODEX_ACP_RELEASE_TAG:-codex-acp-latest}"
CODEX_ACP_DOWNLOAD_BASE_URL="${OMNIHARNESS_CODEX_ACP_DOWNLOAD_BASE_URL:-https://github.com/$CODEX_ACP_RELEASE_REPO/releases/download/$CODEX_ACP_RELEASE_TAG}"
CODEX_ACP_DOCKER_IMAGE="${OMNIHARNESS_CODEX_ACP_DOCKER_IMAGE:-omniharness/codex-acp:local}"
CODEX_ACP_WRAPPER_DIR="${OMNIHARNESS_CODEX_ACP_INSTALL_DIR:-${OMNIHARNESS_CODEX_ACP_WRAPPER_DIR:-}}"
DOCKER_BIN="${OMNIHARNESS_DOCKER_BIN:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "$CODEX_ACP_WRAPPER_DIR" ] && [ -n "${HOME:-}" ]; then
  CODEX_ACP_WRAPPER_DIR="$HOME/.local/bin"
fi

if [ -z "$DOCKER_BIN" ]; then
  if command -v docker >/dev/null 2>&1; then
    DOCKER_BIN="docker"
  elif command -v podman >/dev/null 2>&1; then
    DOCKER_BIN="podman"
  else
    DOCKER_BIN="docker"
  fi
fi

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    --ensure-only)
      ENSURE_ONLY=1
      ;;
    --codex-acp=*)
      CODEX_ACP_INSTALL_MODE="${arg#--codex-acp=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: scripts/install-agent-acp.sh [--dry-run] [--ensure-only] [--codex-acp=auto|binary|cargo|docker]" >&2
      exit 1
      ;;
  esac
done

case "$CODEX_ACP_INSTALL_MODE" in
  auto|binary|cargo|docker)
    ;;
  *)
    echo "Invalid Codex ACP install mode: $CODEX_ACP_INSTALL_MODE" >&2
    echo "Use --codex-acp=auto, --codex-acp=binary, --codex-acp=cargo, or --codex-acp=docker." >&2
    exit 1
    ;;
esac

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

native_cargo_command() {
  if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ] && have_command rustup; then
    echo "rustup run stable-aarch64-apple-darwin cargo"
    return 0
  fi

  echo "cargo"
}

ensure_native_cargo_toolchain() {
  if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ] || ! have_command rustup; then
    return 0
  fi

  if rustup toolchain list 2>/dev/null | grep -q '^stable-aarch64-apple-darwin'; then
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  -> would install Rust toolchain \`stable-aarch64-apple-darwin\` for native Apple Silicon builds"
    return 0
  fi

  echo "  -> installing Rust toolchain \`stable-aarch64-apple-darwin\` for native Apple Silicon builds"
  rustup toolchain install stable-aarch64-apple-darwin
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

  if npm install -g "$package_name"; then
    echo "  -> installed \`$package_name\`"
    return 0
  fi

  echo "  -> failed to install \`$package_name\` with npm" >&2
  return 1
}

run_install_cargo_git() {
  local binary_name="$1"
  local git_url="$2"
  local git_branch="$3"
  local cargo_command

  cargo_command="$(native_cargo_command)"
  if [ "$DRY_RUN" -eq 1 ]; then
    ensure_native_cargo_toolchain
    echo "  -> would install \`$binary_name\` with \`$cargo_command install --locked --git $git_url --branch $git_branch $binary_name\`"
    return 0
  fi

  if ! have_command cargo && ! have_command rustup; then
    echo "  -> cannot install \`$binary_name\`: neither cargo nor rustup is on PATH" >&2
    return 1
  fi

  ensure_native_cargo_toolchain
  # shellcheck disable=SC2086
  if $cargo_command install --locked --git "$git_url" --branch "$git_branch" "$binary_name"; then
    echo "  -> installed \`$binary_name\`"
    return 0
  fi

  echo "  -> failed to install \`$binary_name\` with cargo" >&2
  return 1
}

codex_acp_target() {
  local os_name
  local arch_name

  os_name="$(uname -s)"
  arch_name="$(uname -m)"

  case "$os_name:$arch_name" in
    Darwin:arm64|Darwin:aarch64)
      echo "darwin-arm64"
      ;;
    Darwin:x86_64|Darwin:amd64)
      echo "darwin-x64"
      ;;
    Linux:arm64|Linux:aarch64)
      echo "linux-arm64"
      ;;
    Linux:x86_64|Linux:amd64)
      echo "linux-x64"
      ;;
    *)
      return 1
      ;;
  esac
}

run_install_codex_acp_binary() {
  local target
  local download_url
  local install_path
  local tmp_path

  if ! target="$(codex_acp_target)"; then
    echo "  -> cannot install prebuilt \`codex-acp\`: unsupported platform $(uname -s)/$(uname -m)" >&2
    return 1
  fi

  download_url="$CODEX_ACP_DOWNLOAD_BASE_URL/codex-acp-$target"

  if [ -z "$CODEX_ACP_WRAPPER_DIR" ]; then
    echo "  -> cannot install prebuilt \`codex-acp\`: HOME is not set and OMNIHARNESS_CODEX_ACP_INSTALL_DIR was not provided" >&2
    return 1
  fi

  install_path="$CODEX_ACP_WRAPPER_DIR/codex-acp"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  -> would install prebuilt \`codex-acp\` from \`$download_url\` to $install_path"
    return 0
  fi

  if ! have_command curl && ! have_command wget; then
    echo "  -> cannot install prebuilt \`codex-acp\`: neither curl nor wget is on PATH" >&2
    return 1
  fi

  mkdir -p "$CODEX_ACP_WRAPPER_DIR"
  tmp_path="$(mktemp "$CODEX_ACP_WRAPPER_DIR/codex-acp.tmp.XXXXXX")"

  echo "  -> downloading prebuilt \`codex-acp\` for $target"
  if have_command curl; then
    curl -fL "$download_url" -o "$tmp_path"
  else
    wget -O "$tmp_path" "$download_url"
  fi

  chmod +x "$tmp_path"
  mv "$tmp_path" "$install_path"
  echo "  -> installed prebuilt \`codex-acp\` at $install_path"
}

docker_image_exists() {
  "$DOCKER_BIN" image inspect "$CODEX_ACP_DOCKER_IMAGE" >/dev/null 2>&1
}

ensure_container_runtime() {
  if ! have_command "$DOCKER_BIN"; then
    echo "  -> cannot install Docker-backed \`codex-acp\`: $DOCKER_BIN is not on PATH" >&2
    return 1
  fi

  if "$DOCKER_BIN" info >/dev/null 2>&1; then
    return 0
  fi

  if [ "$(basename "$DOCKER_BIN")" = "podman" ]; then
    echo "  -> starting Podman machine for Docker-backed \`codex-acp\`"
    podman machine start >/dev/null 2>&1 || true
    if "$DOCKER_BIN" info >/dev/null 2>&1; then
      return 0
    fi
  fi

  echo "  -> cannot install Docker-backed \`codex-acp\`: $DOCKER_BIN is installed but its daemon/machine is not reachable" >&2
  return 1
}

write_codex_acp_docker_wrapper() {
  local wrapper_path="$1"

  cat > "$wrapper_path" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail

DEFAULT_CODEX_ACP_DOCKER_IMAGE="$CODEX_ACP_DOCKER_IMAGE"
WRAPPER

  cat >> "$wrapper_path" <<'WRAPPER'

IMAGE="${OMNIHARNESS_CODEX_ACP_DOCKER_IMAGE:-$DEFAULT_CODEX_ACP_DOCKER_IMAGE}"
DOCKER_BIN="${OMNIHARNESS_DOCKER_BIN:-docker}"
HOST_CWD="$(pwd -P)"
HOST_HOME="${HOME:-}"
CONTAINER_HOME="${OMNIHARNESS_CODEX_ACP_CONTAINER_HOME:-/tmp}"

if ! command -v "$DOCKER_BIN" >/dev/null 2>&1; then
  echo "codex-acp Docker wrapper could not find docker on PATH." >&2
  exit 127
fi

if ! "$DOCKER_BIN" info >/dev/null 2>&1; then
  if [ "$(basename "$DOCKER_BIN")" = "podman" ]; then
    podman machine start >/dev/null 2>&1 || true
  fi
fi

mkdir -p "$CONTAINER_HOME" >/dev/null 2>&1 || true

args=(run --rm -i)

if [ "${OMNIHARNESS_CODEX_ACP_DOCKER_AS_ROOT:-0}" != "1" ]; then
  args+=(--user "$(id -u):$(id -g)")
fi

args+=(
  -e "HOME=$CONTAINER_HOME"
  -v "$HOST_CWD:$HOST_CWD"
  -w "$HOST_CWD"
)

add_env_if_set() {
  local name="$1"
  local value="${!name:-}"
  if [ -n "$value" ]; then
    args+=(-e "$name=$value")
  fi
}

mount_existing_path() {
  local host_path="$1"
  local mount_path="$host_path"
  if [ -z "$host_path" ]; then
    return
  fi
  if [ -f "$host_path" ]; then
    mount_path="$(dirname "$host_path")"
  elif [ ! -e "$host_path" ]; then
    mount_path="$(dirname "$host_path")"
  fi
  if [ -e "$mount_path" ]; then
    args+=(-v "$mount_path:$mount_path")
  fi
}

for name in \
  OPENAI_API_KEY \
  OPENAI_BASE_URL \
  CODEX_HOME \
  CODEX_SQLITE_HOME \
  CODEX_MANAGED_CONFIG_PATH \
  CODEX_LOG_STDERR \
  RUST_LOG \
  HTTP_PROXY \
  HTTPS_PROXY \
  NO_PROXY \
  http_proxy \
  https_proxy \
  no_proxy
do
  add_env_if_set "$name"
done

for name in CODEX_HOME CODEX_SQLITE_HOME CODEX_MANAGED_CONFIG_PATH; do
  value="${!name:-}"
  if [ -n "$value" ]; then
    if [ "$name" = "CODEX_HOME" ] || [ "$name" = "CODEX_SQLITE_HOME" ]; then
      mkdir -p "$value" >/dev/null 2>&1 || true
    fi
    mount_existing_path "$value"
  fi
done

if [ -n "$HOST_HOME" ] && [ -d "$HOST_HOME/.codex" ]; then
  args+=(-v "$HOST_HOME/.codex:$CONTAINER_HOME/.codex")
fi

exec "$DOCKER_BIN" "${args[@]}" "$IMAGE" "$@"
WRAPPER

  chmod +x "$wrapper_path"
}

run_install_codex_acp_docker() {
  local dockerfile="$ROOT_DIR/docker/codex-acp/Dockerfile"
  local context_dir="$ROOT_DIR/docker/codex-acp"
  local wrapper_path

  if [ -z "$CODEX_ACP_WRAPPER_DIR" ]; then
    echo "  -> cannot install Docker-backed \`codex-acp\`: HOME is not set and OMNIHARNESS_CODEX_ACP_WRAPPER_DIR was not provided" >&2
    return 1
  fi

  wrapper_path="$CODEX_ACP_WRAPPER_DIR/codex-acp"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  -> would install Docker-backed \`codex-acp\` wrapper at $wrapper_path"
    echo "  -> would use Docker image \`$CODEX_ACP_DOCKER_IMAGE\`"
    echo "  -> would build missing image with \`$DOCKER_BIN build -t $CODEX_ACP_DOCKER_IMAGE -f docker/codex-acp/Dockerfile docker/codex-acp\`"
    return 0
  fi

  if ! ensure_container_runtime; then
    return 1
  fi

  if [ ! -f "$dockerfile" ]; then
    echo "  -> cannot install Docker-backed \`codex-acp\`: missing $dockerfile" >&2
    return 1
  fi

  if docker_image_exists; then
    echo "  -> Docker image \`$CODEX_ACP_DOCKER_IMAGE\` already exists"
  else
    echo "  -> building Docker image \`$CODEX_ACP_DOCKER_IMAGE\`"
    "$DOCKER_BIN" build -t "$CODEX_ACP_DOCKER_IMAGE" -f "$dockerfile" "$context_dir"
  fi

  mkdir -p "$CODEX_ACP_WRAPPER_DIR"
  write_codex_acp_docker_wrapper "$wrapper_path"
  echo "  -> installed Docker-backed \`codex-acp\` wrapper at $wrapper_path"
}

install_codex_acp() {
  case "$CODEX_ACP_INSTALL_MODE" in
    binary)
      run_install_codex_acp_binary
      ;;
    docker)
      run_install_codex_acp_docker
      ;;
    cargo)
      run_install_cargo_git "codex-acp" "https://github.com/danduma/codex-acp.git" "main"
      ;;
    auto)
      if run_install_codex_acp_binary; then
        return 0
      fi
      if have_command "$DOCKER_BIN" && run_install_codex_acp_docker; then
        return 0
      fi
      run_install_cargo_git "codex-acp" "https://github.com/danduma/codex-acp.git" "main"
      ;;
  esac
}

echo "Detecting local coding agents and ACP adapters..."

try_install() {
  if [ "$ENSURE_ONLY" -eq 1 ]; then
    "$@" || echo "  -> install step failed; continuing because --ensure-only was set" >&2
  else
    "$@"
  fi
}

if have_command codex; then
  echo "codex: detected"
  if have_command codex-acp; then
    if [ "$CODEX_ACP_INSTALL_MODE" = "docker" ]; then
      echo "  -> \`codex-acp\` already installed; refreshing Docker-backed \`codex-acp\` wrapper"
      try_install install_codex_acp
    elif [ "$ENSURE_ONLY" -eq 1 ]; then
      echo "  -> \`codex-acp\` already installed"
    else
      if [ "$CODEX_ACP_INSTALL_MODE" = "cargo" ]; then
        echo "  -> \`codex-acp\` already installed; refreshing from the OmniHarness fork"
      else
        echo "  -> \`codex-acp\` already installed; refreshing from the prebuilt release"
      fi
      try_install install_codex_acp
    fi
  else
    try_install install_codex_acp
  fi
else
  echo "codex: not detected"
  if [ "$CODEX_ACP_INSTALL_MODE" = "docker" ]; then
    echo "  -> installing Docker-backed \`codex-acp\`; the Docker image supplies Codex CLI"
    try_install install_codex_acp
  fi
fi

if have_command claude; then
  echo "claude: detected"
  if have_command claude-agent-acp; then
    echo "  -> \`claude-agent-acp\` already installed"
  else
    try_install run_install_npm "@agentclientprotocol/claude-agent-acp"
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
