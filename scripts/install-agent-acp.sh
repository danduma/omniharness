#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=0
ENSURE_ONLY=0
CODEX_ACP_INSTALL_MODE="${OMNIHARNESS_CODEX_ACP_INSTALL:-auto}"
CODEX_ACP_NPM_PACKAGE="${OMNIHARNESS_CODEX_ACP_NPM_PACKAGE:-@agentclientprotocol/codex-acp}"
CODEX_ACP_NPM_ROOT="${OMNIHARNESS_CODEX_ACP_NPM_ROOT:-}"
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

if [ -z "$CODEX_ACP_NPM_ROOT" ] && [ -n "${HOME:-}" ]; then
  CODEX_ACP_NPM_ROOT="$HOME/.local/share/omniharness/codex-acp"
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
      echo "Usage: scripts/install-agent-acp.sh [--dry-run] [--ensure-only] [--codex-acp=auto|npm|binary|cargo|docker]" >&2
      exit 1
      ;;
  esac
done

case "$CODEX_ACP_INSTALL_MODE" in
  auto|npm|binary|cargo|docker)
    ;;
  *)
    echo "Invalid Codex ACP install mode: $CODEX_ACP_INSTALL_MODE" >&2
    echo "Use --codex-acp=auto, --codex-acp=npm, --codex-acp=binary, --codex-acp=cargo, or --codex-acp=docker." >&2
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

installed_npm_package_version() {
  local package_name="$1"
  local package_json
  [ -n "$CODEX_ACP_NPM_ROOT" ] || return 1
  package_json="$CODEX_ACP_NPM_ROOT/node_modules/$package_name/package.json"
  [ -f "$package_json" ] || return 1
  node -e 'process.stdout.write(require(process.argv[1]).version)' "$package_json" 2>/dev/null
}

latest_npm_package_version() {
  local package_name="$1"
  have_command npm || return 1
  npm view "$package_name" version --silent 2>/dev/null
}

managed_codex_acp_npm_is_outdated() {
  local installed_acp
  local installed_codex
  local latest_acp
  local latest_codex
  installed_acp="$(installed_npm_package_version "$CODEX_ACP_NPM_PACKAGE" || true)"
  installed_codex="$(installed_npm_package_version "@openai/codex" || true)"
  latest_acp="$(latest_npm_package_version "$CODEX_ACP_NPM_PACKAGE" || true)"
  latest_codex="$(latest_npm_package_version "@openai/codex" || true)"
  [ -n "$installed_acp" ] && [ -n "$installed_codex" ] || return 0
  [ -n "$latest_acp" ] && [ -n "$latest_codex" ] || return 1
  [ "$installed_acp" != "$latest_acp" ] || [ "$installed_codex" != "$latest_codex" ]
}

run_install_codex_acp_npm() {
  local install_path
  local launcher_path="$ROOT_DIR/scripts/codex-acp-launcher.sh"

  if [ -z "$CODEX_ACP_NPM_ROOT" ] || [ -z "$CODEX_ACP_WRAPPER_DIR" ]; then
    echo "  -> cannot install current \`codex-acp\`: HOME is not set and managed install paths were not provided" >&2
    return 1
  fi
  if ! have_command npm || ! have_command node; then
    echo "  -> cannot install current \`codex-acp\`: npm and node are required" >&2
    return 1
  fi
  if [ ! -f "$launcher_path" ]; then
    echo "  -> cannot install current \`codex-acp\`: missing $launcher_path" >&2
    return 1
  fi

  install_path="$CODEX_ACP_WRAPPER_DIR/codex-acp"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  -> would install the latest official \`$CODEX_ACP_NPM_PACKAGE\` and \`@openai/codex\` at $CODEX_ACP_NPM_ROOT"
    echo "  -> would install its launcher at $install_path"
    return 0
  fi

  mkdir -p "$CODEX_ACP_NPM_ROOT" "$CODEX_ACP_WRAPPER_DIR"
  echo "  -> installing the latest official Codex ACP adapter and Codex CLI"
  npm install --prefix "$CODEX_ACP_NPM_ROOT" "$CODEX_ACP_NPM_PACKAGE@latest" "@openai/codex@latest"
  install -m 0755 "$launcher_path" "$install_path"
  local acp_version
  local codex_version
  acp_version="$(installed_npm_package_version "$CODEX_ACP_NPM_PACKAGE" || echo unknown)"
  codex_version="$(installed_npm_package_version "@openai/codex" || echo unknown)"
  echo "  -> installed \`$CODEX_ACP_NPM_PACKAGE\` $acp_version with Codex $codex_version"
  echo "  -> installed \`codex-acp\` launcher at $install_path"
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
    MINGW64_NT*:x86_64|MSYS_NT*:x86_64|CYGWIN_NT*:x86_64)
      echo "windows-x64"
      ;;
    *)
      return 1
      ;;
  esac
}

codex_acp_binary_name() {
  local target="$1"

  case "$target" in
    windows-*)
      echo "codex-acp.exe"
      ;;
    *)
      echo "codex-acp"
      ;;
  esac
}

codex_acp_asset_name() {
  local target="$1"

  case "$target" in
    windows-*)
      echo "codex-acp-$target.exe"
      ;;
    *)
      echo "codex-acp-$target"
      ;;
  esac
}

sha256_file() {
  local file_path="$1"
  if have_command shasum; then
    shasum -a 256 "$file_path" | awk '{print $1}'
    return 0
  fi
  if have_command sha256sum; then
    sha256sum "$file_path" | awk '{print $1}'
    return 0
  fi
  return 1
}

remote_codex_acp_checksum() {
  local target="$1"
  local asset_name
  local checksum_url
  local checksum_line
  local checksum

  asset_name="$(codex_acp_asset_name "$target")"
  checksum_url="$CODEX_ACP_DOWNLOAD_BASE_URL/$asset_name.sha256"
  if have_command curl; then
    checksum_line="$(curl -fsL "$checksum_url" 2>/dev/null || true)"
  elif have_command wget; then
    checksum_line="$(wget -qO- "$checksum_url" 2>/dev/null || true)"
  else
    return 1
  fi
  checksum="${checksum_line%%[[:space:]]*}"
  case "$checksum" in
    (*[!0-9a-fA-F]*|"") return 1 ;;
  esac
  [ "${#checksum}" -eq 64 ] || return 1
  echo "$checksum" | tr '[:upper:]' '[:lower:]'
}

managed_codex_acp_path() {
  local target="$1"
  local binary_name
  binary_name="$(codex_acp_binary_name "$target")"
  [ -n "$CODEX_ACP_WRAPPER_DIR" ] || return 1
  echo "$CODEX_ACP_WRAPPER_DIR/$binary_name"
}

managed_codex_acp_is_outdated() {
  local target="$1"
  local install_path="$2"
  local expected_checksum
  local actual_checksum

  expected_checksum="$(remote_codex_acp_checksum "$target" || true)"
  [ -n "$expected_checksum" ] || return 1
  actual_checksum="$(sha256_file "$install_path" 2>/dev/null || true)"
  [ -n "$actual_checksum" ] || return 1
  [ "$actual_checksum" != "$expected_checksum" ]
}

# Locate an existing codex-acp on PATH or in well-known install dirs. The restart
# controller (and other launchers) can run with a minimal PATH that omits
# ~/.cargo/bin, so a source-built codex-acp would otherwise look "missing" and get
# clobbered by a prebuilt download. Checking standard locations keeps an existing
# build authoritative.
codex_acp_location() {
  if command -v codex-acp >/dev/null 2>&1; then
    command -v codex-acp
    return 0
  fi
  if command -v codex-acp.exe >/dev/null 2>&1; then
    command -v codex-acp.exe
    return 0
  fi
  local dir
  for dir in "$CODEX_ACP_WRAPPER_DIR" "${CARGO_HOME:-$HOME/.cargo}/bin" "$HOME/.local/bin"; do
    [ -n "$dir" ] || continue
    if [ -x "$dir/codex-acp" ]; then
      echo "$dir/codex-acp"
      return 0
    fi
    if [ -x "$dir/codex-acp.exe" ]; then
      echo "$dir/codex-acp.exe"
      return 0
    fi
  done
  return 1
}

have_codex_acp() {
  codex_acp_location >/dev/null 2>&1
}

run_install_codex_acp_binary() {
  local target
  local asset_name
  local download_url
  local install_path
  local binary_name
  local tmp_path
  local expected_checksum
  local actual_checksum
  local build_metadata_url
  local build_metadata_path
  local tmp_build_metadata_path

  if ! target="$(codex_acp_target)"; then
    echo "  -> cannot install prebuilt \`codex-acp\`: unsupported platform $(uname -s)/$(uname -m)" >&2
    return 1
  fi

  asset_name="$(codex_acp_asset_name "$target")"
  binary_name="$(codex_acp_binary_name "$target")"
  download_url="$CODEX_ACP_DOWNLOAD_BASE_URL/$asset_name"
  build_metadata_url="$CODEX_ACP_DOWNLOAD_BASE_URL/$asset_name.build.json"

  if [ -z "$CODEX_ACP_WRAPPER_DIR" ]; then
    echo "  -> cannot install prebuilt \`codex-acp\`: HOME is not set and OMNIHARNESS_CODEX_ACP_INSTALL_DIR was not provided" >&2
    return 1
  fi

  install_path="$CODEX_ACP_WRAPPER_DIR/$binary_name"

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

  expected_checksum="$(remote_codex_acp_checksum "$target" || true)"
  if [ -n "$expected_checksum" ]; then
    actual_checksum="$(sha256_file "$tmp_path")"
    if [ "$actual_checksum" != "$expected_checksum" ]; then
      echo "  -> downloaded \`codex-acp\` checksum did not match the rolling release" >&2
      return 1
    fi
  fi

  chmod +x "$tmp_path"
  mv "$tmp_path" "$install_path"
  build_metadata_path="$install_path.build.json"
  tmp_build_metadata_path="$build_metadata_path.tmp"
  if have_command curl; then
    if curl -fsL "$build_metadata_url" -o "$tmp_build_metadata_path" 2>/dev/null; then
      mv "$tmp_build_metadata_path" "$build_metadata_path"
    fi
  elif have_command wget; then
    if wget -qO "$tmp_build_metadata_path" "$build_metadata_url" 2>/dev/null; then
      mv "$tmp_build_metadata_path" "$build_metadata_path"
    fi
  fi
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
    npm)
      run_install_codex_acp_npm
      ;;
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
      if run_install_codex_acp_npm; then
        return 0
      fi
      echo "  -> official npm install failed; trying the legacy prebuilt adapter" >&2
      run_install_codex_acp_binary
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
  if have_codex_acp; then
    if [ "$CODEX_ACP_INSTALL_MODE" = "docker" ]; then
      echo "  -> \`codex-acp\` already installed; refreshing Docker-backed \`codex-acp\` wrapper"
      try_install install_codex_acp
    elif [ "$CODEX_ACP_INSTALL_MODE" = "npm" ]; then
      echo "  -> refreshing the official Codex ACP adapter and Codex CLI"
      try_install run_install_codex_acp_npm
    elif [ "$ENSURE_ONLY" -eq 1 ] || [ "$CODEX_ACP_INSTALL_MODE" = "auto" ]; then
      existing_codex_acp="$(codex_acp_location)"
      managed_path="$CODEX_ACP_WRAPPER_DIR/codex-acp"
      if [ "$existing_codex_acp" = "$managed_path" ]; then
        if [ ! -f "$CODEX_ACP_NPM_ROOT/node_modules/$CODEX_ACP_NPM_PACKAGE/package.json" ]; then
          echo "  -> migrating the managed legacy \`codex-acp\` to the maintained official adapter"
          try_install run_install_codex_acp_npm
        elif managed_codex_acp_npm_is_outdated; then
          echo "  -> managed \`codex-acp\` or Codex CLI is outdated; refreshing both"
          try_install run_install_codex_acp_npm
        else
          echo "  -> official \`codex-acp\` and Codex CLI are current"
        fi
      else
        echo "  -> \`codex-acp\` already installed at $existing_codex_acp; leaving it as-is"
        echo "     (official managed installs roll forward automatically; migrate with: scripts/install-agent-acp.sh --codex-acp=npm)"
      fi
    else
      if [ "$CODEX_ACP_INSTALL_MODE" = "cargo" ]; then
        echo "  -> \`codex-acp\` already installed; reinstalling from the OmniHarness fork"
      else
        echo "  -> \`codex-acp\` already installed; reinstalling from the prebuilt release"
      fi
      try_install install_codex_acp
    fi
  else
    try_install install_codex_acp
  fi
else
  echo "codex: not detected"
  if [ "$CODEX_ACP_INSTALL_MODE" = "auto" ] || [ "$CODEX_ACP_INSTALL_MODE" = "npm" ]; then
    echo "  -> installing the official ACP package; it includes the Codex CLI"
    try_install run_install_codex_acp_npm
  elif [ "$CODEX_ACP_INSTALL_MODE" = "docker" ]; then
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
