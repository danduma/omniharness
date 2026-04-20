#!/bin/bash
export ACP_BRIDGE_PORT=7800

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================================="
echo " Starting OmniHarness Multi-Agent CLI Coding Orchestrator"
echo "========================================================="
echo ""

if [ "${MOCK_LLM:-false}" != "true" ]; then
    echo "[1/2] Starting acp-bridge on port $ACP_BRIDGE_PORT..."
    (cd "$DIR/../acp-bridge" && npm run daemon) &
    BRIDGE_PID=$!
else
    echo "[1/2] MOCK_LLM=true, skipping acp-bridge startup."
fi

echo "[2/2] Starting OmniHarness Web UI..."
(cd "$DIR" && npm run dev) &
OMNI_PID=$!

echo ""
echo "========================================================="
echo " OmniHarness is starting!"
echo " Access the Web UI at: http://localhost:3000"
echo " You can configure your API keys securely inside the UI."
echo " Press Ctrl+C to stop both services."
echo "========================================================="

trap 'if [ -n "${BRIDGE_PID:-}" ]; then kill "$BRIDGE_PID" 2>/dev/null; fi; kill "$OMNI_PID" 2>/dev/null' EXIT
wait
