import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import process from "process";
import { acquireBridgeLock, releaseBridgeLock, resolveBridgeLockPath } from "../src/server/dev/bridge-lock";
import { bridgeNeedsBuild, resolveBridgeDir, resolveBridgeUrl, shouldAutoStartBridge } from "../src/server/dev/managed-bridge";

const repoRoot = process.cwd();
const bridgeUrl = resolveBridgeUrl(process.env);
const bridgeDir = resolveBridgeDir(repoRoot, process.env);
const bridgeLockPath = resolveBridgeLockPath(repoRoot);
const webCommand = ["pnpm", ["run", "dev:web"]] as const;
const bridgeCommand = ["pnpm", ["run", "daemon"]] as const;
const setupCommands = [
  { label: "bridge install", command: "pnpm", args: ["install"] },
  { label: "bridge build", command: "pnpm", args: ["build"] },
] as const;

let managedBridgeChild: ChildProcess | null = null;
let webChild: ChildProcess | null = null;
let shuttingDown = false;
let ownsBridgeLock = false;

function prefixStream(stream: NodeJS.ReadableStream | null, prefix: string) {
  if (!stream) {
    return;
  }

  stream.on("data", (chunk) => {
    const text = String(chunk);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.length === 0 && index === lines.length - 1) {
        return;
      }
      process.stdout.write(`[${prefix}] ${line}\n`);
    });
  });
}

function spawnManaged(command: string, args: string[], cwd: string, prefix: string) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  prefixStream(child.stdout, prefix);
  prefixStream(child.stderr, prefix);
  return child;
}

function waitForExit(child: ChildProcess, label: string) {
  return new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} exited with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`));
    });
  });
}

async function runSetupCommand(command: string, args: string[], cwd: string, label: string) {
  const child = spawnManaged(command, args, cwd, label);
  await waitForExit(child, label);
}

async function isBridgeReady() {
  try {
    const response = await fetch(`${bridgeUrl}/agents`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBridgeReady(timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBridgeReady()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ACP bridge at ${bridgeUrl}.`);
}

async function ensureManagedBridge() {
  if (await isBridgeReady()) {
    console.log(`[dev] Reusing running ACP bridge at ${bridgeUrl}`);
    return;
  }

  if (!shouldAutoStartBridge(process.env, bridgeUrl)) {
    throw new Error(
      `ACP bridge is not reachable at ${bridgeUrl}. ` +
      `Start it yourself or point OMNIHARNESS_BRIDGE_URL at a running bridge.`,
    );
  }

  if (!fs.existsSync(bridgeDir)) {
    throw new Error(
      `ACP bridge directory not found at ${bridgeDir}. ` +
      `Set OMNIHARNESS_BRIDGE_DIR or start the bridge manually.`,
    );
  }

  const lockResult = acquireBridgeLock(bridgeLockPath, {
    pid: process.pid,
    bridgeUrl,
    startedAt: Date.now(),
  });

  if (lockResult.status === "locked") {
    console.log(
      `[dev] Another OmniHarness dev process (${lockResult.owner?.pid}) is starting the ACP bridge. Waiting for ${bridgeUrl}...`,
    );
    await waitForBridgeReady(30_000);
    return;
  }

  ownsBridgeLock = true;

  try {
    if (!fs.existsSync(path.join(bridgeDir, "node_modules"))) {
      await runSetupCommand(setupCommands[0].command, [...setupCommands[0].args], bridgeDir, setupCommands[0].label);
    }

    if (bridgeNeedsBuild(bridgeDir)) {
      await runSetupCommand(setupCommands[1].command, [...setupCommands[1].args], bridgeDir, setupCommands[1].label);
    }

    console.log(`[dev] Starting ACP bridge from ${bridgeDir}`);
    managedBridgeChild = spawnManaged(bridgeCommand[0], [...bridgeCommand[1]], bridgeDir, "bridge");

    managedBridgeChild.once("exit", (code, signal) => {
      if (!shuttingDown) {
        console.error(`[dev] ACP bridge exited unexpectedly with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`);
        shutdown(code ?? 1);
      }
    });

    await waitForBridgeReady(30_000);
  } catch (error) {
    releaseBridgeLock(bridgeLockPath, process.pid);
    ownsBridgeLock = false;
    throw error;
  }
}

function launchWeb() {
  console.log("[dev] Starting OmniHarness web UI");
  webChild = spawnManaged(webCommand[0], [...webCommand[1]], repoRoot, "web");

  webChild.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[dev] Web UI exited unexpectedly with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`);
      shutdown(code ?? 1);
    }
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (webChild && !webChild.killed) {
    webChild.kill("SIGTERM");
  }

  if (managedBridgeChild && !managedBridgeChild.killed) {
    managedBridgeChild.kill("SIGTERM");
  }

  if (ownsBridgeLock) {
    releaseBridgeLock(bridgeLockPath, process.pid);
    ownsBridgeLock = false;
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 100);
}

async function main() {
  await ensureManagedBridge();
  launchWeb();

  console.log(`[dev] OmniHarness will use ACP bridge at ${bridgeUrl}`);
  console.log("[dev] Next.js will print the local UI URL when it is ready.");
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
