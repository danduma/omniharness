#!/bin/bash

# Configuration
BRIDGE_PORT=7800
BRIDGE_URL="http://127.0.0.1:$BRIDGE_PORT"
WEB_PORT=3050
OMNI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$(cd "$OMNI_DIR/../acp-bridge" && pwd 2>/dev/null)"

# Function to check if a port is open
is_port_open() {
    # Try nc (netcat)
    if command -v nc >/dev/null 2>&1; then
        nc -z 127.0.0.1 "$1" > /dev/null 2>&1
        return $?
    fi
    # Fallback to /dev/tcp
    (echo > /dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1
    return $?
}

# Function to check if the bridge is responding
is_bridge_ready() {
    curl -s "$BRIDGE_URL/agents" > /dev/null 2>&1
    return $?
}

# Ensure node_modules exist
if [ ! -d "$OMNI_DIR/node_modules" ]; then
    echo "📦 Installing OmniHarness dependencies..."
    (cd "$OMNI_DIR" && pnpm install)
fi

# 1. Start acp-bridge if not running
if ! is_port_open "$BRIDGE_PORT"; then
    echo "🚀 Starting acp-bridge..."
    if [ -d "$BRIDGE_DIR" ]; then
        if [ ! -d "$BRIDGE_DIR/node_modules" ]; then
            echo "📦 Installing acp-bridge dependencies..."
            (cd "$BRIDGE_DIR" && pnpm install)
        fi
        (cd "$BRIDGE_DIR" && pnpm run daemon > "$OMNI_DIR/bridge.log" 2>&1) &
        echo "   Bridge logs: $OMNI_DIR/bridge.log"
    else
        echo "❌ Error: acp-bridge directory not found at $BRIDGE_DIR"
        exit 1
    fi
fi

# 2. Start Web UI if not running
if ! is_port_open "$WEB_PORT"; then
    echo "🚀 Starting OmniHarness Web UI..."
    (cd "$OMNI_DIR" && pnpm dev > "$OMNI_DIR/web.log" 2>&1) &
    echo "   Web UI logs: $OMNI_DIR/web.log"
fi

# 3. Wait for bridge to be ready
if ! is_bridge_ready; then
    echo "⏳ Waiting for services to be ready..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    while ! is_bridge_ready && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        sleep 1
        ((RETRY_COUNT++))
    done
fi

if ! is_bridge_ready; then
    echo "❌ Timeout waiting for acp-bridge to start."
    echo "Check $OMNI_DIR/bridge.log for details."
    exit 1
fi

# 4. Run the CLI command
if [ $# -eq 0 ]; then
    echo "✅ Services are running."
    echo ""
    echo "Usage: ./omni.sh <plan-path>"
    echo "Example: ./omni.sh vibes/initial-plan.md"
    exit 0
fi

# Use pnpm exec tsx to run the cli
pnpm exec tsx "$OMNI_DIR/omni-cli.ts" "$@"
