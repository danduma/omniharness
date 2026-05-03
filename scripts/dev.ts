import { execFileSync, spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import process from "process";
import { acquireBridgeLock, releaseBridgeLock, resolveBridgeLockPath } from "../src/server/dev/bridge-lock";
import { describeBridgeToolingProblem } from "../src/server/dev/bridge-health";
import { bridgeNeedsBuild, resolveBridgeDir, resolveBridgeUrl, shouldAutoStartBridge } from "../src/server/dev/managed-bridge";

const repoRoot = process.cwd();
const webPort = process.env.PORT || "3050";
process.env.PORT = webPort;
const webHost = process.env.OMNIHARNESS_WEB_HOST?.trim() || "0.0.0.0";
const proxyPort = process.env.OMNIHARNESS_DEV_PROXY_PORT?.trim() || "3035";
const shouldLaunchProxy = process.env.OMNIHARNESS_DEV_PROXY !== "0";
process.env.OMNIHARNESS_DEV_PROXY_PORT = proxyPort;
process.env.OMNIHARNESS_DEV_PROXY_TARGET ||= `http://127.0.0.1:${webPort}`;
const bridgeUrl = resolveBridgeUrl(process.env);
const bridgeDir = resolveBridgeDir(repoRoot, process.env);
const bridgeLockPath = resolveBridgeLockPath(repoRoot);
const webCommand = ["pnpm", ["run", "dev:web", "--hostname", webHost, "--port", webPort]] as const;
const proxyCommand = ["pnpm", ["run", "dev:proxy"]] as const;
const bridgeCommand = ["pnpm", ["exec", "tsx", "scripts/agent-runtime.ts"]] as const;
const setupCommands = [
  { label: "runtime install", command: "pnpm", args: ["install"] },
  { label: "runtime build", command: "pnpm", args: ["build"] },
] as const;

let managedBridgeChild: ChildProcess | null = null;
let webChild: ChildProcess | null = null;
let proxyChild: ChildProcess | null = null;
let shuttingDown = false;
let ownsBridgeLock = false;

function bridgePort() {
  try {
    return new URL(bridgeUrl).port || "80";
  } catch {
    return null;
  }
}

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
    const agentsResponse = await fetch(`${bridgeUrl}/agents`);
    if (!agentsResponse.ok) {
      return false;
    }

    const doctorResponse = await fetch(`${bridgeUrl}/doctor`);
    if (!doctorResponse.ok) {
      return false;
    }

    return describeBridgeToolingProblem(await doctorResponse.json()) === null;
  } catch {
    return false;
  }
}

async function describeReachableBridgeProblem() {
  try {
    const agentsResponse = await fetch(`${bridgeUrl}/agents`);
    if (!agentsResponse.ok) {
      return null;
    }

    const doctorResponse = await fetch(`${bridgeUrl}/doctor`);
    if (!doctorResponse.ok) {
      return `doctor returned HTTP ${doctorResponse.status}`;
    }

    return describeBridgeToolingProblem(await doctorResponse.json());
  } catch {
    return null;
  }
}

function findBridgeListenerPids() {
  const port = bridgePort();
  if (!port) {
    return [];
  }

  try {
    const output = execFileSync("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    });

    return output
      .split(/\r?\n/g)
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

async function waitForBridgeToStop(timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (findBridgeListenerPids().length === 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return false;
}

async function stopStaleLocalBridge(reason: string) {
  const pids = findBridgeListenerPids();
  if (pids.length === 0) {
    return false;
  }

  console.log(`[dev] Restarting stale local agent runtime at ${bridgeUrl}: ${reason}`);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The process may have exited between lsof and kill.
    }
  }

  if (await waitForBridgeToStop(5_000)) {
    fs.rmSync(bridgeLockPath, { force: true });
    return true;
  }

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The process may have exited after SIGTERM.
    }
  }

  const stopped = await waitForBridgeToStop(2_000);
  if (stopped) {
    fs.rmSync(bridgeLockPath, { force: true });
  }
  return stopped;
}

async function waitForBridgeReady(timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBridgeReady()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for OmniHarness agent runtime at ${bridgeUrl}.`);
}

async function ensureManagedBridge() {
  if (await isBridgeReady()) {
    console.log(`[dev] Reusing running agent runtime at ${bridgeUrl}`);
    return;
  }

  const reachableBridgeProblem = await describeReachableBridgeProblem();
  if (reachableBridgeProblem) {
    if (shouldAutoStartBridge(process.env, bridgeUrl) && await stopStaleLocalBridge(reachableBridgeProblem)) {
      return ensureManagedBridge();
    }

    throw new Error(
      `OmniHarness agent runtime is already running at ${bridgeUrl}, but it is missing required standard tools: ` +
      `${reachableBridgeProblem}. Restart the agent runtime so new workers get the current Codex tool wiring.`,
    );
  }

  if (!shouldAutoStartBridge(process.env, bridgeUrl)) {
    throw new Error(
      `OmniHarness agent runtime is not reachable at ${bridgeUrl}. ` +
      `Start it yourself or point OMNIHARNESS_BRIDGE_URL at a running runtime.`,
    );
  }

  if (!fs.existsSync(bridgeDir)) {
    throw new Error(
      `OmniHarness runtime directory not found at ${bridgeDir}. ` +
      `Set OMNIHARNESS_RUNTIME_DIR or start the runtime manually.`,
    );
  }

  const lockResult = acquireBridgeLock(bridgeLockPath, {
    pid: process.pid,
    bridgeUrl,
    startedAt: Date.now(),
  });

  if (lockResult.status === "locked") {
    console.log(
      `[dev] Another OmniHarness dev process (${lockResult.owner?.pid}) is starting the agent runtime. Waiting for ${bridgeUrl}...`,
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

    console.log(`[dev] Starting OmniHarness agent runtime from ${bridgeDir}`);
    managedBridgeChild = spawnManaged(bridgeCommand[0], [...bridgeCommand[1]], bridgeDir, "bridge");

    managedBridgeChild.once("exit", (code, signal) => {
      if (!shuttingDown) {
        console.error(`[dev] OmniHarness agent runtime exited unexpectedly with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`);
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
  console.log(`[dev] Starting OmniHarness web UI on ${webHost}:${webPort}`);
  webChild = spawnManaged(webCommand[0], [...webCommand[1]], repoRoot, "web");

  webChild.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[dev] Web UI exited unexpectedly with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`);
      shutdown(code ?? 1);
    }
  });
}

function launchProxy() {
  if (!shouldLaunchProxy) {
    return;
  }

  console.log(`[dev] Starting compressed tunnel proxy on 127.0.0.1:${proxyPort}`);
  proxyChild = spawnManaged(proxyCommand[0], [...proxyCommand[1]], repoRoot, "proxy");

  proxyChild.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[dev] Tunnel proxy exited unexpectedly with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`);
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

  if (proxyChild && !proxyChild.killed) {
    proxyChild.kill("SIGTERM");
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
  launchProxy();

  console.log(`[dev] OmniHarness will use agent runtime at ${bridgeUrl}`);
  console.log("[dev] Next.js will print the local and network UI URLs when it is ready.");
  if (shouldLaunchProxy) {
    console.log(`[dev] Point Cloudflare Tunnel at http://localhost:${proxyPort} for compressed remote dev.`);
  }
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
