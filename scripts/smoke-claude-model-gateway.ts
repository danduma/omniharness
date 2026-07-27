import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fetchLatestCliProxyRelease,
  installCliProxyApi,
} from "@/server/integrations/claude-model-gateway/installer";
import { createClaudeModelGatewayClient } from "@/server/integrations/claude-model-gateway/client";
import { createClaudeModelGatewayProcessManager } from "@/server/integrations/claude-model-gateway/process-manager";

type Outcome = "passed" | "blocked_environment" | "failed_feature";

async function unusedPort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a loopback port.");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

function token() {
  return `omni-smoke-${randomBytes(24).toString("base64url")}`;
}

async function main() {
  const requireNetwork = process.argv.includes("--require-network");
  const homeDir = await mkdtemp(join(tmpdir(), "omniharness-gateway-smoke-"));
  let outcome: Outcome = "failed_feature";
  let stage = "prerequisites";
  let version = "unknown";
  let manager: ReturnType<typeof createClaudeModelGatewayProcessManager> | null = null;
  try {
    if (!["darwin", "linux", "win32"].includes(process.platform) || !["arm64", "x64"].includes(process.arch)) {
      outcome = "blocked_environment";
      throw new Error(`unsupported ${process.platform}/${process.arch}`);
    }
    stage = "release_metadata";
    let release;
    try {
      release = await fetchLatestCliProxyRelease();
    } catch (error) {
      outcome = "blocked_environment";
      throw error;
    }
    stage = "verified_install";
    const installed = await installCliProxyApi({ homeDir, release, pathValue: "" });
    version = installed.version;
    const port = await unusedPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const apiToken = token();
    const managementToken = token();
    const client = createClaudeModelGatewayClient({ baseUrl, apiToken, managementToken, timeoutMs: 2_000 });
    manager = createClaudeModelGatewayProcessManager({
      homeDir,
      checkReady: () => client.checkReady().then(() => undefined),
    });
    stage = "readiness";
    await manager.start({ executable: installed.executable, baseUrl, apiToken, managementToken });
    stage = "models_endpoint";
    await client.listModels();
    stage = "management_endpoint";
    await client.createCodexOAuthUrl();
    stage = "owned_stop";
    const stopped = await manager.stop();
    if (!stopped.stopped) throw new Error("Owned process did not stop.");
    outcome = "passed";
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 180) : String(error).slice(0, 180);
    console.log(JSON.stringify({ outcome, stage, version, platform: `${process.platform}/${process.arch}`, reason }));
    if (outcome === "blocked_environment" && !requireNetwork) return;
    process.exitCode = 1;
    return;
  } finally {
    if (manager) await manager.stop().catch(() => undefined);
    await rm(homeDir, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ outcome, stage, version, platform: `${process.platform}/${process.arch}` }));
}

void main().catch((error) => {
  const reason = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
  console.log(JSON.stringify({ outcome: "blocked_environment", stage: "bootstrap", version: "unknown", platform: `${process.platform}/${process.arch}`, reason }));
  process.exitCode = 1;
});
