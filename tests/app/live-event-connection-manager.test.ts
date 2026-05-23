import { describe, expect, it, vi } from "vitest";
import { AppRequestError } from "@/lib/app-errors";
import { buildEventStreamUrl, LiveEventConnectionManager } from "@/app/home/LiveEventConnectionManager";
import type { EventStreamState } from "@/app/home/types";

function createState(id: string): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [{
      id,
      planId: "plan-1",
      mode: "implementation",
      status: "running",
      createdAt: new Date(0).toISOString(),
      projectPath: null,
      title: id,
    }],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
  };
}

function createWorkerEntriesNotifier() {
  return {
    onKnownSeqs: vi.fn(),
    onStreamResync: vi.fn(),
    onWakeUp: vi.fn(),
  };
}

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  emit(event: string, data: unknown) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  close() {
    this.closed = true;
  }
}

async function flushAsyncWork() {
  await vi.runAllTicks();
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
  await vi.advanceTimersByTimeAsync(0);
}

describe("LiveEventConnectionManager", () => {
  it("includes the snapshot anchor when opening the event stream", () => {
    expect(buildEventStreamUrl("run-1", "42")).toBe("/api/events?runId=run-1&lastEventId=42");

    MockEventSource.instances = [];
    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      initialLastEventId: "42",
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson: vi.fn().mockResolvedValue(createState("persisted-initial")),
      applyUpdate: vi.fn(),
      reportError: vi.fn(),
    });

    manager.start();

    expect(MockEventSource.instances[0]?.url).toBe("/api/events?runId=run-1&lastEventId=42");

    manager.stop();
  });

  it("polls the persisted snapshot endpoint without reporting transient connectivity loss", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const applyUpdate = vi.fn();
    const reportError = vi.fn();
    const requestJson = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(createState("persisted-recovery"));

    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate,
      reportError,
      fallbackIntervalMs: 100,
      fallbackCooldownMs: 0,
    });

    manager.start();
    expect(MockEventSource.instances[0]?.url).toBe("/api/events?runId=run-1");
    expect(requestJson).toHaveBeenCalledWith(
      "/api/events?snapshot=1&persisted=1&runId=run-1",
      undefined,
      expect.objectContaining({ action: "Load live state snapshot" }),
    );

    await vi.runAllTicks();
    await Promise.resolve();
    expect(reportError).not.toHaveBeenCalled();

    MockEventSource.instances[0]?.onerror?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(reportError).not.toHaveBeenCalled();
    expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      runs: [expect.objectContaining({ id: "persisted-recovery" })],
    }));

    manager.stop();
    vi.useRealTimers();
  });

  it("reports non-connectivity snapshot failures", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const reportError = vi.fn();
    const requestJson = vi
      .fn()
      .mockRejectedValue(new AppRequestError({ message: "Request failed with status 530", status: 530 }));

    const manager = new LiveEventConnectionManager({
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate: vi.fn(),
      reportError,
      fallbackCooldownMs: 0,
    });

    manager.start();
    await vi.runAllTicks();
    await Promise.resolve();

    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({
      action: "Load live state snapshot",
      status: 530,
    }));

    manager.stop();
    vi.useRealTimers();
  });

  it("stops fallback polling after a live update arrives", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const applyUpdate = vi.fn();
    const requestJson = vi.fn().mockResolvedValue(createState("persisted-initial"));
    const manager = new LiveEventConnectionManager({
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate,
      reportError: vi.fn(),
      fallbackIntervalMs: 100,
      fallbackCooldownMs: 0,
    });

    manager.start();
    MockEventSource.instances[0]?.onerror?.();
    MockEventSource.instances[0]?.emit("update", createState("stream-restored"));

    await vi.advanceTimersByTimeAsync(350);

    expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      runs: [expect.objectContaining({ id: "stream-restored" })],
    }));
    expect(requestJson).toHaveBeenCalledTimes(1);

    manager.stop();
    vi.useRealTimers();
  });

  it("uses snapshot worker seq hints to recover missed worker entry wake-ups", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const workerEntries = createWorkerEntriesNotifier();
    const requestJson = vi.fn().mockResolvedValue(createState("persisted-initial"));
    const manager = new LiveEventConnectionManager({
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate: vi.fn(),
      reportError: vi.fn(),
      workerEntries,
      fallbackCooldownMs: 0,
    });

    manager.start();
    MockEventSource.instances[0]?.emit("update", {
      ...createState("stream-update"),
      workerEntrySeqs: { "worker-1": 7 },
    });

    expect(workerEntries.onKnownSeqs).toHaveBeenCalledWith({ "worker-1": 7 });

    manager.stop();
    vi.useRealTimers();
  });

  it("routes worker entry wake-ups and resync controls through the worker stream manager", () => {
    MockEventSource.instances = [];
    const workerEntries = createWorkerEntriesNotifier();
    const manager = new LiveEventConnectionManager({
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson: vi.fn().mockResolvedValue(createState("persisted-initial")),
      applyUpdate: vi.fn(),
      reportError: vi.fn(),
      workerEntries,
    });

    manager.start();
    MockEventSource.instances[0]?.emit("worker.entry_appended", { workerId: "worker-1", seq: 3 });
    MockEventSource.instances[0]?.emit("stream.resync_required", { reason: "test" });

    expect(workerEntries.onWakeUp).toHaveBeenCalledWith({ workerId: "worker-1", seq: 3 });
    expect(workerEntries.onStreamResync).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it("rebootstraps from a persisted snapshot and reconnects from its anchor after an event-stream resync", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const applyUpdate = vi.fn();
    const workerEntries = createWorkerEntriesNotifier();
    const requestSnapshot = vi
      .fn()
      .mockResolvedValueOnce({
        data: createState("persisted-initial"),
        lastEventId: "11",
      })
      .mockResolvedValueOnce({
        data: {
          ...createState("persisted-after-gap"),
          workerEntrySeqs: { "worker-1": 8 },
        },
        lastEventId: "100",
      });
    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      initialLastEventId: "10",
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestSnapshot,
      applyUpdate,
      reportError: vi.fn(),
      workerEntries,
    });

    manager.start();
    await flushAsyncWork();

    expect(MockEventSource.instances[0]?.url).toBe("/api/events?runId=run-1&lastEventId=10");
    MockEventSource.instances[0]?.emit("stream.resync_required", { reason: "event buffer gap" });
    await flushAsyncWork();

    expect(workerEntries.onStreamResync).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances[0]?.closed).toBe(true);
    expect(MockEventSource.instances[1]?.url).toBe("/api/events?runId=run-1&lastEventId=100");
    expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      runs: [expect.objectContaining({ id: "persisted-after-gap" })],
    }));
    expect(workerEntries.onKnownSeqs).toHaveBeenCalledWith({ "worker-1": 8 });

    manager.stop();
    vi.useRealTimers();
  });

  it("captures event cursors from persisted snapshot response headers", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(createState("persisted-initial")), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-omni-last-event-id": "73",
        },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(createState("persisted-after-gap")), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-omni-last-event-id": "99",
        },
      }));
    globalThis.fetch = fetchMock;
    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      initialLastEventId: "10",
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      applyUpdate: vi.fn(),
      reportError: vi.fn(),
    });

    try {
      manager.start();
      await flushAsyncWork();

      MockEventSource.instances[0]?.emit("stream.resync_required", { reason: "event buffer gap" });
      await flushAsyncWork();

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/events?snapshot=1&persisted=1&runId=run-1",
        undefined,
      );
      expect(MockEventSource.instances[0]?.closed).toBe(true);
      expect(MockEventSource.instances[1]?.url).toBe("/api/events?runId=run-1&lastEventId=99");
    } finally {
      manager.stop();
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });

  it("keeps validating persisted snapshots after an open stream reconnects without a changed payload", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const workerEntries = createWorkerEntriesNotifier();
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce(createState("persisted-initial"))
      .mockResolvedValueOnce({ notModified: true, snapshotChecksum: "sha256:unchanged" })
      .mockResolvedValueOnce({
        ...createState("persisted-revalidated"),
        workerEntrySeqs: { "worker-1": 9 },
      });
    const manager = new LiveEventConnectionManager({
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate: vi.fn(),
      reportError: vi.fn(),
      workerEntries,
      fallbackIntervalMs: 100,
      fallbackCooldownMs: 0,
      snapshotValidationIntervalMs: 100,
    });

    manager.start();
    await flushAsyncWork();

    MockEventSource.instances[0]?.onerror?.();
    await flushAsyncWork();

    MockEventSource.instances[0]?.onopen?.();
    await vi.advanceTimersByTimeAsync(100);

    expect(requestJson).toHaveBeenCalledTimes(3);
    expect(workerEntries.onKnownSeqs).toHaveBeenCalledWith({ "worker-1": 9 });

    manager.stop();
    vi.useRealTimers();
  });

  it("sends the cached snapshot checksum and skips unchanged snapshot payloads", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const applyUpdate = vi.fn();
    const workerEntries = createWorkerEntriesNotifier();
    const requestJson = vi.fn().mockResolvedValue({
      notModified: true,
      snapshotChecksum: "sha256:cached",
      workerEntrySeqs: { "worker-1": 12 },
    });
    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      getSnapshotChecksum: () => "sha256:cached",
      applyUpdate,
      reportError: vi.fn(),
      workerEntries,
      fallbackCooldownMs: 0,
    });

    manager.start();
    await vi.runAllTicks();
    await Promise.resolve();

    expect(requestJson).toHaveBeenCalledWith(
      "/api/events?snapshot=1&persisted=1&runId=run-1&checksum=sha256%3Acached",
      undefined,
      expect.objectContaining({ action: "Load live state snapshot" }),
    );
    expect(applyUpdate).not.toHaveBeenCalled();
    expect(workerEntries.onKnownSeqs).toHaveBeenCalledWith({ "worker-1": 12 });

    manager.stop();
    vi.useRealTimers();
  });

  it("does not forward worker entry cursors from a notModified snapshot after the manager has stopped", async () => {
    MockEventSource.instances = [];
    const applyUpdate = vi.fn();
    const workerEntries = createWorkerEntriesNotifier();

    let resolveSnapshot: (value: unknown) => void = () => {
      throw new Error("Snapshot promise resolver was not installed.");
    };
    const inFlightSnapshot = new Promise<unknown>((resolve) => {
      resolveSnapshot = resolve;
    });
    const requestJson = vi.fn().mockReturnValue(inFlightSnapshot);

    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      getSnapshotChecksum: () => "sha256:cached",
      applyUpdate,
      reportError: vi.fn(),
      workerEntries,
      fallbackCooldownMs: 0,
    });

    manager.start();
    // Stop the manager BEFORE the in-flight snapshot resolves. Mirrors
    // the real "selectedRunId changed mid-poll" race: the old manager
    // must not write cursor hints for the now-replaced selection.
    manager.stop();
    resolveSnapshot({
      notModified: true,
      snapshotChecksum: "sha256:cached",
      workerEntrySeqs: { "stale-worker": 99 },
    });
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }

    expect(applyUpdate).not.toHaveBeenCalled();
    expect(workerEntries.onKnownSeqs).not.toHaveBeenCalled();
  });
});
