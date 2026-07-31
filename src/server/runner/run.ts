import path from "node:path";
import { dbReady } from "@/server/db";
import { emitNamedEvent } from "@/server/events/named-events";
import {
  ensureClaudeModelGatewayStartedAtBoot,
  getClaudeModelGatewayService,
} from "@/server/integrations/claude-model-gateway";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { getTerminalManager } from "@/server/terminal/terminal-manager";
import { createOmniRuntime } from "@/runtime";
import { buildRuntimeBootstrap } from "@/runtime/bootstrap";
import { startOmniServer, type OmniServerHandle } from "@/runtime/http/server";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import { createNodeManagedBridgeController } from "./bridge-dependencies";
import type { RunnerConfig } from "./config";
import { RunnerReadinessManager } from "./readiness-manager";
import { acquireRunnerLock } from "./runner-lock";
import { emitRunnerStaticUiStatus } from "./static-ui-status";
import { configureRunnerReadinessSource } from "./identity";

export interface RunnerProcessHandle {
  origin: string;
  readiness: RunnerReadinessManager;
  stop(): Promise<void>;
}

function isLoopbackBridge(bridgeUrl: string) {
  const hostname = new URL(bridgeUrl).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function buildBridgeEnvironment(config: RunnerConfig) {
  const parsed = new URL(config.bridgeUrl);
  return {
    ...process.env,
    OMNIHARNESS_ROOT: config.instanceRoot,
    OMNIHARNESS_BRIDGE_URL: config.bridgeUrl,
    OMNIHARNESS_AGENT_RUNTIME_HOST: parsed.hostname,
    OMNIHARNESS_AGENT_RUNTIME_PORT:
      parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
  };
}

function bootstrapSearchParams(
  requestUrl: string,
  selectedRunId: string | null,
) {
  const values: Record<string, string | string[] | undefined> = {};
  const url = new URL(requestUrl);
  for (const [key, value] of url.searchParams) {
    const current = values[key];
    values[key] = current === undefined
      ? value
      : Array.isArray(current)
        ? [...current, value]
        : [current, value];
  }
  if (selectedRunId) {
    values.run = selectedRunId;
  }
  return values;
}

export async function startRunnerProcess(
  config: RunnerConfig,
): Promise<RunnerProcessHandle> {
  const runnerLock = acquireRunnerLock({
    lockPath: config.runnerLockPath,
    record: {
      pid: process.pid,
      host: config.host,
      port: config.port,
      startedAt: Date.now(),
    },
  });
  let server: OmniServerHandle | null = null;
  let stopped = false;
  const releaseLockOnExit = () => runnerLock.release();
  process.once("exit", releaseLockOnExit);

  const bridge = createNodeManagedBridgeController({
    bridgeUrl: config.bridgeUrl,
    bridgeLockPath: config.bridgeLockPath,
    command: process.execPath,
    args: [
      "--import",
      "tsx",
      path.join(config.repositoryRoot, "scripts", "agent-runtime.ts"),
    ],
    cwd: config.repositoryRoot,
    env: buildBridgeEnvironment(config),
    manage: config.manageBridge && isLoopbackBridge(config.bridgeUrl),
  });
  const readiness = new RunnerReadinessManager(bridge);
  configureRunnerReadinessSource(readiness);

  try {
    await dbReady;
    await ensureSupervisorRuntimeStarted();
    await ensureClaudeModelGatewayStartedAtBoot();
    await bridge.start();

    const runtime = createOmniRuntime({
      surface: "web",
      label: "OmniHarness Server",
      hooks: {
        async onStop() {
          getTerminalManager().killAll();
          await getClaudeModelGatewayService().shutdown();
          await bridge.stop();
        },
      },
    });
    server = await startOmniServer({
      runtime,
      registry: createOmniRuntimeHttpRegistry(),
      host: config.host,
      port: config.port,
      surface: "web",
      staticDir: config.staticDir,
      staticDirExplicit: config.staticDirExplicit,
      staticMode: "web",
      buildStaticBootstrap: ({ request, selectedRunId }) =>
        buildRuntimeBootstrap({
          searchParams: bootstrapSearchParams(request.url, selectedRunId),
          requestHeaders: request.headers,
          includeInitialData: false,
        }),
    });
    emitRunnerStaticUiStatus(config, server.staticUiEnabled);
    readiness.markHttpListening(server.origin);
    emitNamedEvent({
      kind: "runner.started",
      origin: server.origin,
      bridgeUrl: config.bridgeUrl,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    emitNamedEvent({
      kind: "runner.start_failed",
      reason,
      host: config.host,
      port: config.port,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "runner.start_failed",
      message: reason,
      surface: "log",
      cause: error instanceof Error
        ? { name: error.name, message: error.message }
        : null,
    });
    await bridge.stop().catch(() => undefined);
    runnerLock.release();
    process.off("exit", releaseLockOnExit);
    configureRunnerReadinessSource(null);
    throw error;
  }

  return {
    origin: server.origin,
    readiness,
    async stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      readiness.markStopping();
      try {
        await server?.stop();
      } finally {
        await bridge.stop().catch(() => undefined);
        runnerLock.release();
        process.off("exit", releaseLockOnExit);
        readiness.markStopped();
        configureRunnerReadinessSource(null);
      }
    },
  };
}
