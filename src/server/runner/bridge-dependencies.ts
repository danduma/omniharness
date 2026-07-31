import { spawn, type ChildProcess } from "node:child_process";
import {
  acquireBridgeLock,
  isBridgeStarterProcessAlive,
  releaseBridgeLock,
} from "@/server/dev/bridge-lock";
import { describeBridgeToolingProblem } from "@/server/dev/bridge-health";
import {
  ManagedBridgeController,
  type BridgeChild,
  type BridgeProbeResult,
  type ManagedBridgeDependencies,
} from "./managed-bridge-controller";

export interface NodeBridgeControllerOptions {
  bridgeUrl: string;
  bridgeLockPath: string;
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  manage: boolean;
}

async function probeBridge(bridgeUrl: string): Promise<BridgeProbeResult> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 2_000);
  timeout.unref();
  try {
    const agents = await fetch(`${bridgeUrl}/agents`, {
      signal: abortController.signal,
    });
    if (!agents.ok) {
      return {
        status: "unhealthy",
        reason: `agents returned HTTP ${agents.status}`,
      };
    }
    const doctor = await fetch(`${bridgeUrl}/doctor`, {
      signal: abortController.signal,
    });
    if (!doctor.ok) {
      return {
        status: "unhealthy",
        reason: `doctor returned HTTP ${doctor.status}`,
      };
    }
    const toolingProblem = describeBridgeToolingProblem(await doctor.json());
    return toolingProblem
      ? { status: "unhealthy", reason: toolingProblem }
      : { status: "ready" };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function waitForChildExit(child: ChildProcess, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    timeout.unref();
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

function wrapChild(child: ChildProcess): BridgeChild {
  return {
    pid: child.pid ?? null,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      if (!await waitForChildExit(child, 1_000)) {
        child.kill("SIGKILL");
        await waitForChildExit(child, 1_000);
      }
    },
    onExit(listener) {
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        listener({ code, signal });
      };
      child.on("exit", onExit);
      return () => child.off("exit", onExit);
    },
  };
}

export function createNodeBridgeDependencies(
  options: NodeBridgeControllerOptions,
): ManagedBridgeDependencies {
  return {
    probe: () => probeBridge(options.bridgeUrl),
    acquireLock: () => {
      const result = acquireBridgeLock(
        options.bridgeLockPath,
        {
          pid: process.pid,
          bridgeUrl: options.bridgeUrl,
          startedAt: Date.now(),
        },
        isBridgeStarterProcessAlive,
      );
      return result.status === "acquired"
        ? { status: "acquired" as const }
        : {
          status: "locked" as const,
          ownerPid: result.owner?.pid ?? null,
        };
    },
    releaseLock: () => releaseBridgeLock(options.bridgeLockPath, process.pid),
    spawn: async () => {
      const child = spawn(options.command, options.args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "inherit", "inherit"],
      });
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      return wrapChild(child);
    },
    schedule(delayMs, callback) {
      const timer = setTimeout(callback, delayMs);
      timer.unref();
      return { cancel: () => clearTimeout(timer) };
    },
  };
}

export function createNodeManagedBridgeController(
  options: NodeBridgeControllerOptions,
) {
  return new ManagedBridgeController({
    bridgeUrl: options.bridgeUrl,
    manage: options.manage,
    dependencies: createNodeBridgeDependencies(options),
  });
}
