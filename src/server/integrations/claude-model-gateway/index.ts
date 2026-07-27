import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import type {
  ClaudeModelGatewayAction,
  ClaudeModelGatewayOperation,
  ClaudeModelGatewayStatus,
} from "@/lib/claude-model-gateway";
import { emitNamedEvent, type ClaudeModelGatewayEvent, type NamedEvent, type SurfacedErrorCode } from "@/server/events/named-events";
import { createClaudeModelGatewayClient, type ClaudeModelGatewayClient } from "./client";
import { inspectCliProxyApiInstallation, installCliProxyApi, type InstalledCliProxyApi } from "./installer";
import { createClaudeModelGatewayProcessManager } from "./process-manager";
import {
  readClaudeModelGatewaySettings,
  saveClaudeModelGatewayCatalog,
  saveClaudeModelGatewaySettings,
  writeProvisionalManagedGatewaySettings,
  type ClaudeModelGatewaySettings,
} from "./settings";

type ServiceEvent = ClaudeModelGatewayEvent | Extract<NamedEvent, { kind: "error.surfaced" }>;

type ServiceDependencies = {
  homeDir: string;
  readSettings: () => Promise<ClaudeModelGatewaySettings>;
  saveSettings: (settings: Partial<ClaudeModelGatewaySettings>) => Promise<unknown>;
  writeProvisionalSettings: () => Promise<ClaudeModelGatewaySettings>;
  saveCatalog: (models: ClaudeModelGatewaySettings["catalog"]["models"], updatedAt?: Date) => Promise<unknown>;
  inspectInstallation: () => Promise<InstalledCliProxyApi | null>;
  installBinary: () => Promise<InstalledCliProxyApi>;
  createClient: (settings: ClaudeModelGatewaySettings) => ClaudeModelGatewayClient;
  createProcessManager: (settings: ClaudeModelGatewaySettings, client: ClaudeModelGatewayClient) => {
    inspect: () => Promise<{ running: boolean; owned: boolean }>;
    start: (input: { executable: string; baseUrl: string; apiToken: string; managementToken: string }) => Promise<unknown>;
    stop: () => Promise<unknown>;
  };
  emit: (event: ServiceEvent) => void;
  pollIntervalMs: number;
  oauthTimeoutMs: number;
  createOperationId: () => string;
};

const emptyStatus = (): ClaudeModelGatewayStatus => ({
  revision: 0,
  mode: "managed",
  enabled: false,
  installation: "absent",
  service: "stopped",
  oauth: "disconnected",
  connection: { baseUrl: "http://127.0.0.1:8317", apiTokenConfigured: false, managementTokenConfigured: false },
  installedVersion: null,
  installedSource: null,
  operation: null,
  models: { custom: [], discovered: [], updatedAt: null, stale: false },
});

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function publicMessage(error: unknown, settings: ClaudeModelGatewaySettings | null) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [settings?.apiToken, settings?.managementToken]) {
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  return message.slice(0, 500);
}

function publicError(error: unknown, settings: ClaudeModelGatewaySettings | null) {
  return new Error(publicMessage(error, settings));
}

export function createClaudeModelGatewayService(options: Partial<ServiceDependencies> & Pick<ServiceDependencies, "homeDir">) {
  const deps: ServiceDependencies = {
    homeDir: options.homeDir,
    readSettings: options.readSettings ?? readClaudeModelGatewaySettings,
    saveSettings: options.saveSettings ?? saveClaudeModelGatewaySettings,
    writeProvisionalSettings: options.writeProvisionalSettings ?? writeProvisionalManagedGatewaySettings,
    saveCatalog: options.saveCatalog ?? saveClaudeModelGatewayCatalog,
    inspectInstallation: options.inspectInstallation ?? (() => inspectCliProxyApiInstallation(options.homeDir)),
    installBinary: options.installBinary ?? (() => installCliProxyApi({ homeDir: options.homeDir })),
    createClient: options.createClient ?? ((settings) => createClaudeModelGatewayClient(settings)),
    createProcessManager: options.createProcessManager ?? ((settings, client) => createClaudeModelGatewayProcessManager({
      homeDir: options.homeDir,
      mode: settings.mode,
      checkReady: () => client.checkReady().then(() => undefined),
    })),
    emit: options.emit ?? ((event) => emitNamedEvent(event)),
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
    oauthTimeoutMs: options.oauthTimeoutMs ?? 5 * 60_000,
    createOperationId: options.createOperationId ?? randomUUID,
  };
  let snapshot = emptyStatus();
  let latestSettings: ClaudeModelGatewaySettings | null = null;
  let oauthPollFence: string | null = null;
  const inFlight = new Map<ClaudeModelGatewayAction, Promise<Record<string, unknown>>>();
  let serialTail: Promise<void> = Promise.resolve();

  const serialize = <T>(task: () => Promise<T>) => {
    const result = serialTail.then(task);
    serialTail = result.then(() => undefined, () => undefined);
    return result;
  };

  const update = (patch: Partial<Omit<ClaudeModelGatewayStatus, "revision">>) => {
    snapshot = { ...snapshot, ...patch, revision: snapshot.revision + 1 };
    return snapshot;
  };

  const syncConfiguration = async () => {
    const settings = await deps.readSettings();
    latestSettings = settings;
    const installed = await deps.inspectInstallation();
    update({
      mode: settings.mode,
      enabled: settings.enabled,
      installation: settings.mode === "external" ? "installed" : installed ? "installed" : "absent",
      connection: {
        baseUrl: settings.baseUrl,
        apiTokenConfigured: settings.apiToken.trim().length > 0,
        managementTokenConfigured: settings.managementToken.trim().length > 0,
      },
      installedVersion: installed?.version ?? null,
      installedSource: installed?.source ?? null,
      models: {
        custom: settings.customModels,
        discovered: settings.catalog.models,
        updatedAt: settings.catalog.updatedAt,
        stale: settings.catalog.updatedAt ? Date.now() - Date.parse(settings.catalog.updatedAt) > 24 * 60 * 60 * 1_000 : false,
      },
    });
    return { settings, installed };
  };

  const fail = (input: {
    operationId: string;
    action: ClaudeModelGatewayAction;
    error: unknown;
    code: SurfacedErrorCode;
    event: ClaudeModelGatewayEvent;
    state?: Partial<ClaudeModelGatewayStatus>;
  }) => {
    const message = publicMessage(input.error, latestSettings);
    const operation: ClaudeModelGatewayOperation = {
      id: input.operationId,
      kind: input.action,
      state: "failed",
      error: { code: input.code, message },
    };
    update({ ...input.state, operation });
    deps.emit({ ...input.event, reason: message } as ClaudeModelGatewayEvent);
    deps.emit({ kind: "error.surfaced", code: input.code, message, surface: "toast" });
  };

  const run = <T extends Record<string, unknown>>(action: ClaudeModelGatewayAction, task: (operationId: string) => Promise<T>) => {
    const existing = inFlight.get(action);
    if (existing) return existing as Promise<T>;
    const operationId = deps.createOperationId();
    const promise = serialize(() => task(operationId)).finally(() => { inFlight.delete(action); });
    inFlight.set(action, promise);
    return promise;
  };

  const completeOperation = (operationId: string, kind: ClaudeModelGatewayAction, state: Partial<ClaudeModelGatewayStatus> = {}) => {
    update({ ...state, operation: { id: operationId, kind, state: "completed", error: null } });
  };

  const pollOAuth = async (operationId: string, client: ClaudeModelGatewayClient) => {
    const deadline = Date.now() + deps.oauthTimeoutMs;
    try {
      while (oauthPollFence === operationId && Date.now() < deadline) {
        if (await client.isCodexOAuthConnected()) {
          await serialize(async () => {
            if (oauthPollFence !== operationId) return;
            oauthPollFence = null;
            update({ oauth: "connected" });
            deps.emit({ kind: "claude_gateway.oauth_completed", operationId });
          });
          return;
        }
        await wait(deps.pollIntervalMs);
      }
      if (oauthPollFence !== operationId) return;
      throw new Error("Gateway provider connection timed out.");
    } catch (error) {
      await serialize(async () => {
        if (oauthPollFence !== operationId) return;
        oauthPollFence = null;
        fail({
          operationId,
          action: "connect",
          error,
          code: "claude_gateway.oauth_failed",
          event: { kind: "claude_gateway.oauth_failed", operationId, reason: "" },
          state: { oauth: "error" },
        });
      });
    }
  };

  const restoreOAuthState = async (settings: ClaudeModelGatewaySettings, client: ClaudeModelGatewayClient) => {
    try {
      update({ oauth: await client.isCodexOAuthConnected() ? "connected" : "disconnected" });
    } catch (error) {
      const message = publicMessage(error, settings);
      update({ oauth: "error" });
      deps.emit({ kind: "claude_gateway.oauth_probe_failed", mode: settings.mode, reason: message });
      deps.emit({ kind: "error.surfaced", code: "claude_gateway.oauth_failed", message, surface: "log" });
    }
  };

  const inspect = async () => {
    const { settings } = await syncConfiguration();
    const client = deps.createClient(settings);
    let shouldProbe = false;
    if (settings.mode === "managed") {
      const processState = await deps.createProcessManager(settings, client).inspect();
      shouldProbe = processState.running && processState.owned;
      if (!shouldProbe) update({ service: "stopped", oauth: "disconnected" });
    } else {
      shouldProbe = settings.enabled;
      if (!shouldProbe) update({ service: "stopped", oauth: "disconnected" });
    }
    if (shouldProbe) {
      try {
        await client.checkReady();
        update({ service: "running" });
        await restoreOAuthState(settings, client);
      } catch (error) {
        const message = publicMessage(error, settings);
        update({ service: "unreachable", oauth: "disconnected" });
        deps.emit({ kind: "claude_gateway.service_probe_failed", mode: settings.mode, reason: message });
        deps.emit({ kind: "error.surfaced", code: "claude_gateway.not_ready", message, surface: "log" });
      }
    }
    return structuredClone(snapshot);
  };

  return {
    getSnapshot: () => structuredClone(snapshot),
    inspect: () => serialize(inspect),
    install() {
      return run("install", async (operationId) => {
        update({ installation: "installing", operation: { id: operationId, kind: "install", state: "running" } });
        deps.emit({ kind: "claude_gateway.install_started", operationId });
        try {
          latestSettings = await deps.writeProvisionalSettings();
          const installed = await deps.installBinary();
          completeOperation(operationId, "install", {
            installation: "installed",
            installedVersion: installed.version,
            installedSource: installed.source,
          });
          deps.emit({ kind: "claude_gateway.install_completed", operationId, version: installed.version, source: installed.source });
          return { operationId, status: structuredClone(snapshot) };
        } catch (error) {
          fail({
            operationId,
            action: "install",
            error,
            code: /unsupported/i.test(publicMessage(error, latestSettings)) ? "claude_gateway.unsupported_platform" : "claude_gateway.install_failed",
            event: { kind: "claude_gateway.install_failed", operationId, reason: "" },
            state: { installation: /unsupported/i.test(publicMessage(error, latestSettings)) ? "unsupported" : "error" },
          });
          throw publicError(error, latestSettings);
        }
      });
    },
    start() {
      return run("start", async (operationId) => {
        const { settings, installed } = await syncConfiguration();
        update({ service: "starting", operation: { id: operationId, kind: "start", state: "running" } });
        deps.emit({ kind: "claude_gateway.service_starting", operationId, mode: settings.mode });
        const client = deps.createClient(settings);
        try {
          if (!settings.apiToken) throw new Error("Gateway API token is not configured.");
          if (settings.mode === "managed") {
            if (!settings.managementToken) throw new Error("Gateway management token is not configured.");
            if (!installed) throw new Error("CLIProxyAPI is not installed.");
            await deps.createProcessManager(settings, client).start({
              executable: installed.executable,
              baseUrl: settings.baseUrl,
              apiToken: settings.apiToken,
              managementToken: settings.managementToken,
            });
          } else {
            await client.checkReady();
          }
          await deps.saveSettings({ enabled: true });
          latestSettings = { ...settings, enabled: true };
          completeOperation(operationId, "start", { enabled: true, service: "running" });
          deps.emit({ kind: "claude_gateway.service_started", operationId, mode: settings.mode });
          return { operationId, status: structuredClone(snapshot) };
        } catch (error) {
          fail({
            operationId,
            action: "start",
            error,
            code: settings.mode === "managed" ? "process.spawn.failed" : "claude_gateway.not_ready",
            event: { kind: "claude_gateway.service_start_failed", operationId, mode: settings.mode, reason: "" },
            state: { service: "error" },
          });
          throw publicError(error, latestSettings);
        }
      });
    },
    stop() {
      return run("stop", async (operationId) => {
        const { settings } = await syncConfiguration();
        update({ operation: { id: operationId, kind: "stop", state: "running" } });
        const client = deps.createClient(settings);
        try {
          oauthPollFence = null;
          if (settings.mode === "managed") await deps.createProcessManager(settings, client).stop();
          await deps.saveSettings({ enabled: false });
          latestSettings = { ...settings, enabled: false };
          completeOperation(operationId, "stop", { enabled: false, service: "stopped", oauth: "disconnected" });
          deps.emit({ kind: "claude_gateway.service_stopped", operationId, mode: settings.mode });
          return { operationId, status: structuredClone(snapshot) };
        } catch (error) {
          fail({
            operationId,
            action: "stop",
            error,
            code: "process.stop.failed",
            event: { kind: "claude_gateway.service_stop_failed", operationId, mode: settings.mode, reason: "" },
            state: { service: "error" },
          });
          throw publicError(error, latestSettings);
        }
      });
    },
    connect() {
      return run("connect", async (operationId) => {
        const { settings } = await syncConfiguration();
        const client = deps.createClient(settings);
        update({ oauth: "connecting", operation: { id: operationId, kind: "connect", state: "running" } });
        try {
          const oauth = await client.createCodexOAuthUrl();
          completeOperation(operationId, "connect", { oauth: "connecting" });
          deps.emit({ kind: "claude_gateway.oauth_started", operationId });
          oauthPollFence = operationId;
          void pollOAuth(operationId, client);
          return { operationId, ...oauth, status: structuredClone(snapshot) };
        } catch (error) {
          fail({
            operationId,
            action: "connect",
            error,
            code: "claude_gateway.oauth_failed",
            event: { kind: "claude_gateway.oauth_failed", operationId, reason: "" },
            state: { oauth: "error" },
          });
          throw publicError(error, latestSettings);
        }
      });
    },
    refreshModels() {
      return run("refresh_models", async (operationId) => {
        const { settings } = await syncConfiguration();
        const client = deps.createClient(settings);
        update({ operation: { id: operationId, kind: "refresh_models", state: "running" } });
        try {
          const models = await client.listModels();
          const updatedAt = new Date();
          await deps.saveCatalog(models, updatedAt);
          completeOperation(operationId, "refresh_models", {
            models: { custom: settings.customModels, discovered: models, updatedAt: updatedAt.toISOString(), stale: false },
          });
          deps.emit({ kind: "claude_gateway.models_refreshed", operationId, count: models.length });
          return { operationId, status: structuredClone(snapshot) };
        } catch (error) {
          fail({
            operationId,
            action: "refresh_models",
            error,
            code: "claude_gateway.model_discovery_failed",
            event: { kind: "claude_gateway.models_refresh_failed", operationId, reason: "" },
          });
          throw publicError(error, latestSettings);
        }
      });
    },
    async ensureReady() {
      return serialize(async () => {
        const { settings } = await syncConfiguration();
        if (!settings.enabled) throw new Error("Claude model gateway is disabled.");
        await deps.createClient(settings).checkReady();
        update({ service: "running" });
        return settings;
      });
    },
    shutdown() {
      return serialize(async () => {
        const operationId = deps.createOperationId();
        const { settings } = await syncConfiguration();
        const client = deps.createClient(settings);
        oauthPollFence = null;
        try {
          if (settings.mode === "managed") await deps.createProcessManager(settings, client).stop();
          completeOperation(operationId, "stop", { enabled: settings.enabled, service: "stopped", oauth: "disconnected" });
          deps.emit({ kind: "claude_gateway.service_stopped", operationId, mode: settings.mode });
          return { operationId, status: structuredClone(snapshot) };
        } catch (error) {
          fail({
            operationId,
            action: "stop",
            error,
            code: "process.stop.failed",
            event: { kind: "claude_gateway.service_stop_failed", operationId, mode: settings.mode, reason: "" },
            state: { service: "error" },
          });
          throw publicError(error, latestSettings);
        }
      });
    },
  };
}

const singleton = createClaudeModelGatewayService({ homeDir: homedir() });

export function getClaudeModelGatewayService() {
  return singleton;
}

export async function ensureClaudeModelGatewayStartedAtBoot() {
  const settings = await readClaudeModelGatewaySettings();
  if (!settings.enabled) return getClaudeModelGatewayService().inspect();
  return getClaudeModelGatewayService().start();
}

let shutdownHandlersRegistered = false;

export function registerClaudeModelGatewayShutdownHandlers() {
  if (shutdownHandlersRegistered) return;
  shutdownHandlersRegistered = true;
  let shuttingDown = false;
  const handle = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    void getClaudeModelGatewayService().shutdown()
      .catch((error) => console.error("Failed to stop Claude model gateway during shutdown", error))
      .finally(() => {
        process.removeListener("SIGINT", onSigint);
        process.removeListener("SIGTERM", onSigterm);
        process.kill(process.pid, signal);
      });
  };
  const onSigint = () => handle("SIGINT");
  const onSigterm = () => handle("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
}
