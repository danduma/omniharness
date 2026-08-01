import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  RunnerConnection,
  BoundedRunnerPreviewCache,
  calculateRunnerReconnectDelay,
  type RunnerConnectionRuntime,
  type RunnerStreamHandlers,
} from "@/interface/runners/RunnerConnection";
import type { RunnerIdentityLearningResult } from "@/interface/runners/RunnerProfile";
import type { RunnerProfile } from "@/interface/runners/RunnerProfile";

function profile(overrides: Partial<RunnerProfile> = {}): RunnerProfile {
  return {
    id: "profile-1",
    runnerInstanceId: "runner-1",
    label: "Runner",
    baseUrl: "https://runner.example",
    savedPassword: null,
    authTransport: "bearer",
    credentialRef: "credential-1",
    schemaVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastConnectedAt: null,
    isSameOrigin: false,
    ...overrides,
  };
}

function bootstrap(overrides: Record<string, unknown> = {}) {
  return {
    runner: {
      runnerInstanceId: "runner-1",
      name: "Runner",
      version: "0.1.0",
      apiRevision: { minimum: 1, current: 1 },
      capabilities: [],
      bridgeState: "ready",
      readinessState: "ready",
      streamEpoch: "epoch",
    },
    initialEventState: { runs: [{ id: "run-1" }] },
    initialLastEventId: "epoch:1",
    ...overrides,
  };
}

function runtime(options: {
  bootstrap?: () => Promise<unknown>;
  onOpen?: (handlers: {
    onOpen?(): void;
    onEvent?(event: unknown): void;
    onError?(error: { code: string; message: string }): void;
  }) => void;
} = {}) {
  const closeMain = vi.fn();
  const closeTerminal = vi.fn();
  const api: RunnerConnectionRuntime = {
    bootstrap: {
      load: options.bootstrap ?? (async () => bootstrap()),
    },
    events: {
      snapshot: async () => ({ data: { runs: [{ id: "run-1" }] }, lastEventId: "epoch:2" }),
      open(_input, handlers) {
        options.onOpen?.(handlers);
        return { close: closeMain };
      },
    },
    terminals: {
      openStream() {
        return { close: closeTerminal };
      },
    },
  };
  return { api, closeMain, closeTerminal };
}

function persistence(initial = profile()) {
  let current = initial;
  let scoped = {
    preferences: {},
    drafts: {},
    cursors: {},
  } as {
    preferences: Record<string, unknown>;
    drafts: Record<string, string>;
    cursors: Record<string, string>;
  };
  const learnIdentity = vi.fn(async (
    _id: string,
    identity: string,
  ): Promise<RunnerIdentityLearningResult> => {
    current = { ...current, runnerInstanceId: identity };
    return { status: "accepted", profileId: current.id };
  });
  return {
    setProfile(next: RunnerProfile) { current = next; },
    getProfile: () => current,
    scopeKey: () => current.runnerInstanceId ?? current.id,
    getScopedState: () => scoped,
    updateScopedState: vi.fn(async (_id: string, patch: Partial<typeof scoped>) => {
      scoped = {
        preferences: { ...scoped.preferences, ...patch.preferences },
        drafts: { ...scoped.drafts, ...patch.drafts },
        cursors: { ...scoped.cursors, ...patch.cursors },
      };
    }),
    learnIdentity,
  };
}

describe("RunnerConnection", () => {
  it("connects, owns one main stream, and detaches only terminal streams when inactive", async () => {
    const transport = runtime({
      onOpen: (handlers) => handlers.onOpen?.(),
    });
    const saved = persistence();
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => transport.api,
      persistence: saved,
    });

    await connection.start();
    expect(connection.getSnapshot()).toEqual(expect.objectContaining({
      status: "online",
      runnerInstanceId: "runner-1",
    }));
    connection.setActive(true);
    connection.openTerminalStream("terminal-1", {});
    connection.setActive(false);
    expect(transport.closeTerminal).toHaveBeenCalledOnce();
    expect(transport.closeMain).not.toHaveBeenCalled();

    await connection.start();
    expect(transport.closeMain).not.toHaveBeenCalled();
  });

  it.each([
    ["runtime.http_401", "needs-reauth"],
    ["tls.untrusted", "tls-untrusted"],
    ["runner.deferred", "deferred"],
  ] as const)("maps %s bootstrap failures to %s", async (code, status) => {
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => runtime({
        bootstrap: async () => {
          throw { code, message: code };
        },
      }).api,
      persistence: persistence(),
      schedule: () => 1,
      cancelSchedule: () => {},
    });

    await connection.start();
    expect(connection.getSnapshot().status).toBe(status);
  });

  it("blocks an incompatible revision and an unexpected trusted identity", async () => {
    const incompatible = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => runtime({
        bootstrap: async () => bootstrap({
          runner: {
            ...bootstrap().runner,
            apiRevision: { minimum: 999, current: 999 },
          },
        }),
      }).api,
      persistence: persistence(),
    });
    await incompatible.start();
    expect(incompatible.getSnapshot().status).toBe("incompatible");

    const mismatchPersistence = persistence();
    mismatchPersistence.learnIdentity.mockResolvedValueOnce({
      status: "identity_mismatch",
      profileId: "profile-1",
      expectedRunnerInstanceId: "runner-1",
      observedRunnerInstanceId: "runner-other",
    });
    const mismatch = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => runtime({
        bootstrap: async () => bootstrap({
          runner: { ...bootstrap().runner, runnerInstanceId: "runner-other" },
        }),
      }).api,
      persistence: mismatchPersistence,
    });
    await mismatch.start();
    expect(mismatch.getSnapshot()).toEqual(expect.objectContaining({
      status: "identity-mismatch",
      observedRunnerInstanceId: "runner-other",
    }));
  });

  it("ignores a delayed bootstrap after stop or generation replacement", async () => {
    let resolveBootstrap!: (value: unknown) => void;
    const delayed = new Promise<unknown>((resolve) => {
      resolveBootstrap = resolve;
    });
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => runtime({ bootstrap: () => delayed }).api,
      persistence: persistence(),
    });
    const starting = connection.start();
    connection.stop();
    resolveBootstrap(bootstrap());
    await starting;

    expect(connection.getSnapshot().status).toBe("offline");
  });

  it("persists cursors, clears them on resync, and enters degraded backoff after four resyncs", async () => {
    vi.useFakeTimers();
    let handlers: RunnerStreamHandlers | null = null;
    const saved = persistence();
    const transport = runtime({ onOpen: (next) => { handlers = next; next.onOpen?.(); } });
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => transport.api,
      persistence: saved,
      now: () => Date.now(),
      schedule: (callback, delay) => Number(setTimeout(callback, delay)),
      cancelSchedule: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      random: () => 0.5,
    });
    await connection.start();
    handlers!.onEvent!({ kind: "update", lastEventId: "epoch:3", payload: { runs: [] } });
    await Promise.resolve();
    expect(saved.updateScopedState).toHaveBeenCalledWith("profile-1", {
      cursors: { events: "epoch:3" },
    });

    for (let index = 0; index < 4; index += 1) {
      handlers!.onEvent!({ kind: "stream.resync_required", payload: { reason: "epoch_mismatch" } });
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(connection.getSnapshot().status).toBe("degraded");
    expect(connection.getSnapshot().resyncCount).toBe(4);
    expect(saved.updateScopedState).toHaveBeenCalledWith("profile-1", {
      cursors: { events: "" },
    });
    vi.useRealTimers();
  });

  it("uses jittered exponential retry capped at five minutes", () => {
    expect(calculateRunnerReconnectDelay(0, 0.5)).toBe(1_000);
    expect(calculateRunnerReconnectDelay(20, 1)).toBe(300_000);
  });

  it("gives EventSource time to reconnect before falling back to a fresh connection", async () => {
    let handlers: RunnerStreamHandlers | null = null;
    const schedule = vi.fn(() => 1);
    const cancelSchedule = vi.fn();
    const transport = runtime({
      onOpen: (next) => {
        handlers = next;
        next.onOpen?.();
      },
    });
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => transport.api,
      persistence: persistence(),
      schedule,
      cancelSchedule,
    });

    await connection.start();
    handlers!.onError!({
      code: "runtime.events_reconnecting",
      message: "Event stream is reconnecting.",
    });

    expect(connection.getSnapshot().status).toBe("degraded");
    expect(transport.closeMain).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledOnce();

    handlers!.onOpen!();
    expect(connection.getSnapshot().status).toBe("online");
    expect(cancelSchedule).toHaveBeenCalledWith(1);
  });

  it("surfaces runner stopping frames without reconnecting", async () => {
    let handlers: RunnerStreamHandlers | null = null;
    const transport = runtime({ onOpen: (next) => { handlers = next; } });
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => transport.api,
      persistence: persistence(),
    });
    await connection.start();

    handlers!.onEvent!({ kind: "runner.stopping", payload: { reason: "shutdown" } });

    expect(connection.getSnapshot().status).toBe("runner-stopping");
  });

  it("requires authorization again when its authenticated stream is revoked", async () => {
    let handlers: RunnerStreamHandlers | null = null;
    const transport = runtime({ onOpen: (next) => { handlers = next; } });
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => transport.api,
      persistence: persistence(),
    });
    await connection.start();

    handlers!.onEvent!({
      kind: "auth.session_revoked",
      reason: "revoked",
    });

    expect(connection.getSnapshot()).toEqual(expect.objectContaining({
      status: "needs-reauth",
      lastError: expect.objectContaining({ code: "runtime.http_401" }),
    }));
    expect(transport.closeMain).toHaveBeenCalledOnce();
  });

  it("applies runner rename events and requires confirmation after a rekey", async () => {
    let handlers: RunnerStreamHandlers | null = null;
    const transport = runtime({ onOpen: (next) => { handlers = next; } });
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => transport.api,
      persistence: persistence(),
    });
    await connection.start();

    handlers!.onEvent!({ kind: "runner.renamed", name: "Studio Runner" });
    expect(connection.getSnapshot().runnerName).toBe("Studio Runner");

    handlers!.onEvent!({
      kind: "runner.rekeyed",
      runnerInstanceId: "runner-2",
    });
    expect(connection.getSnapshot()).toEqual(expect.objectContaining({
      status: "identity-mismatch",
      observedRunnerInstanceId: "runner-2",
    }));
  });

  it("ignores stale authentication responses after credential replacement", async () => {
    let resolveOld!: (value: unknown) => void;
    const oldBootstrap = new Promise<unknown>((resolve) => { resolveOld = resolve; });
    const saved = persistence();
    let factoryCalls = 0;
    const connection = new RunnerConnection({
      profile: profile(),
      persistence: saved,
      runtimeFactory: async () => {
        factoryCalls += 1;
        return factoryCalls === 1
          ? runtime({ bootstrap: () => oldBootstrap }).api
          : runtime({ bootstrap: async () => bootstrap() }).api;
      },
    });
    const oldStart = connection.start();
    const replacement = profile({ credentialRef: "credential-2" });
    saved.setProfile(replacement);
    connection.updateProfile(replacement);
    await Promise.resolve();
    await Promise.resolve();
    resolveOld(bootstrap({
      runner: { ...bootstrap().runner, runnerInstanceId: "stale-runner" },
    }));
    await oldStart;
    await Promise.resolve();

    expect(factoryCalls).toBe(2);
    expect(connection.getSnapshot().runnerInstanceId).toBe("runner-1");
    expect(connection.getSnapshot().observedRunnerInstanceId).toBeNull();
  });

  it("cancels reconnect timers when stopped", async () => {
    let retry: (() => void) | null = null;
    const cancel = vi.fn();
    let factoryCalls = 0;
    const connection = new RunnerConnection({
      profile: profile(),
      persistence: persistence(),
      runtimeFactory: async () => {
        factoryCalls += 1;
        return runtime({
          bootstrap: async () => {
            throw new TypeError("Failed to fetch");
          },
        }).api;
      },
      schedule: (callback) => {
        retry = callback;
        return 1;
      },
      cancelSchedule: cancel,
    });
    await connection.start();
    connection.stop();
    const scheduledRetry = retry as (() => void) | null;
    scheduledRetry?.();
    await Promise.resolve();

    expect(cancel).toHaveBeenCalledWith(1);
    expect(factoryCalls).toBe(1);
  });

  it("bounds preview caches with least-recently-used eviction", () => {
    const cache = new BoundedRunnerPreviewCache<number>(2);
    cache.set("one", 1);
    cache.set("two", 2);
    expect(cache.get("one")).toBe(1);
    cache.set("three", 3);

    expect(cache.get("two")).toBeUndefined();
    expect(cache.get("one")).toBe(1);
    expect(cache.size).toBe(2);
  });

  it("keeps runner mutations and query data isolated after active switching", async () => {
    const queryClient = new QueryClient();
    const connection = new RunnerConnection({
      profile: profile(),
      runtimeFactory: async () => runtime().api,
      persistence: persistence(),
      queryClient,
    });
    const pending = Promise.resolve("finished");
    queryClient.setQueryData(["runner-1", "mutation"], pending);
    connection.setActive(false);

    await expect(pending).resolves.toBe("finished");
    expect(queryClient.getQueryData(["runner-1", "mutation"])).toBe(pending);
  });
});
