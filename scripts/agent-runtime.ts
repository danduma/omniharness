#!/usr/bin/env node
import { createAgentRuntimeServer } from "../src/server/agent-runtime/http";

const port = Number(process.env.OMNIHARNESS_AGENT_RUNTIME_PORT || process.env.ACP_BRIDGE_PORT || "7800");
const host = process.env.OMNIHARNESS_AGENT_RUNTIME_HOST || process.env.ACP_BRIDGE_HOST || "127.0.0.1";

const server = createAgentRuntimeServer({
  env: process.env,
});

server.listen(port, host, () => {
  process.stdout.write(JSON.stringify({
    ok: true,
    event: "listening",
    host,
    port,
    runtime: "omniharness-agent-runtime",
  }) + "\n");
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
