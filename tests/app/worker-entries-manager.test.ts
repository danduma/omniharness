import { describe, expect, it, vi } from "vitest";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { EMPTY_WORKER_STREAM_STATE, WorkerEntriesManager } from "@/app/home/WorkerEntriesManager";

function entry(seq: number, overrides: Partial<WorkerEntry> = {}): WorkerEntry {
  return {
    id: `e-${seq}`,
    seq,
    type: "message",
    text: `m${seq}`,
    timestamp: new Date(1700000000000 + seq).toISOString(),
    ...overrides,
  };
}

function buildManager(responses: Array<{ entries: WorkerEntry[]; latestSeq: number }>) {
  let call = 0;
  const requestJson = vi.fn(async () => {
    const response = responses[call] ?? responses[responses.length - 1];
    call += 1;
    return response;
  });
  const manager = new WorkerEntriesManager({ requestJson: requestJson as unknown as never });
  return { manager, requestJson };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("WorkerEntriesManager", () => {
  it("reuses one empty stream snapshot for the no-worker subscription path", () => {
    expect(EMPTY_WORKER_STREAM_STATE).toBe(EMPTY_WORKER_STREAM_STATE);
    expect(EMPTY_WORKER_STREAM_STATE.workerId).toBe("__none__");
  });

  it("caches the initial per-worker snapshot for useSyncExternalStore", () => {
    const { manager } = buildManager([]);
    expect(manager.getState("w1")).toBe(manager.getState("w1"));
    expect(manager.getState("w2")).toBe(manager.getState("w2"));
    expect(manager.getState("w1")).not.toBe(manager.getState("w2"));
  });

  it("hydrates a worker stream from bootstrap entries without an initial request", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(2)], latestSeq: 2 },
    ]);
    const state = manager.getState("w1", [entry(1), entry(2)]);

    expect(state.entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(state.status).toBe("loaded");
    expect(state.latestContiguousSeq).toBe(2);
    expect(manager.isLoaded("w1")).toBe(true);

    await manager.ensureLoaded("w1");
    expect(requestJson).not.toHaveBeenCalled();
  });

  it("ensureLoaded fills the entries prefix and marks loaded", async () => {
    const { manager } = buildManager([
      { entries: [entry(1), entry(2), entry(3)], latestSeq: 3 },
    ]);
    await manager.ensureLoaded("w1");
    const state = manager.getState("w1");
    expect(state.entries.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(state.latestContiguousSeq).toBe(3);
    expect(state.latestKnownSeq).toBe(3);
    expect(manager.isLoaded("w1")).toBe(true);
  });

  it("appends new entries via onWakeUp without re-fetching the contiguous prefix", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(1)], latestSeq: 1 },
      { entries: [entry(2)], latestSeq: 2 },
    ]);
    await manager.ensureLoaded("w1");
    manager.onWakeUp({ workerId: "w1", seq: 2 });
    // The wake-up triggers a fetch with afterSeq=1
    await new Promise((resolve) => setTimeout(resolve, 0));
    const state = manager.getState("w1");
    expect(state.entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(state.latestContiguousSeq).toBe(2);
    expect(requestJson).toHaveBeenLastCalledWith(
      "/api/workers/w1/entries?afterSeq=1",
      undefined,
      expect.objectContaining({ source: "Worker entries" }),
    );
  });

  it("recovers from a seq gap by chaining a second fetch", async () => {
    const { manager } = buildManager([
      // First fetch: only entries 1 and 2 available
      { entries: [entry(1), entry(2)], latestSeq: 5 },
      // Second fetch (chase the known gap): entries 3..5
      { entries: [entry(3), entry(4), entry(5)], latestSeq: 5 },
    ]);
    await manager.ensureLoaded("w1");
    // The chained fetch is fire-and-forget; poll until it lands.
    for (let i = 0; i < 50 && !manager.isLoaded("w1"); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const state = manager.getState("w1");
    expect(state.entries.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(state.latestContiguousSeq).toBe(5);
    expect(state.latestKnownSeq).toBe(5);
    expect(manager.isLoaded("w1")).toBe(true);
  });

  it("isLoaded stays false while latestContiguousSeq < latestKnownSeq", async () => {
    const { manager } = buildManager([
      // Server says latest is 10 but only entries 1..3 returned (simulated transient gap).
      { entries: [entry(1), entry(2), entry(3)], latestSeq: 10 },
      // Subsequent fetches keep stalling at 3 (server hasn't caught up yet).
      { entries: [], latestSeq: 10 },
    ]);
    await manager.ensureLoaded("w1");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const state = manager.getState("w1");
    expect(state.latestContiguousSeq).toBe(3);
    expect(state.latestKnownSeq).toBe(10);
    expect(manager.isLoaded("w1")).toBe(false);
  });

  it("retries when a wake-up advances latestKnownSeq during an in-flight empty fetch", async () => {
    const first = deferred<{ entries: WorkerEntry[]; latestSeq: number }>();
    const second = deferred<{ entries: WorkerEntry[]; latestSeq: number }>();
    const requestJson = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const manager = new WorkerEntriesManager({ requestJson: requestJson as unknown as never });

    const initialLoad = manager.ensureLoaded("w1");
    expect(requestJson).toHaveBeenCalledWith(
      "/api/workers/w1/entries?afterSeq=0",
      undefined,
      expect.objectContaining({ source: "Worker entries" }),
    );

    manager.onWakeUp({ workerId: "w1", seq: 2 });
    first.resolve({ entries: [], latestSeq: 0 });
    await initialLoad;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(requestJson).toHaveBeenLastCalledWith(
      "/api/workers/w1/entries?afterSeq=0",
      undefined,
      expect.objectContaining({ source: "Worker entries" }),
    );

    second.resolve({ entries: [entry(1), entry(2)], latestSeq: 2 });
    for (let i = 0; i < 50 && !manager.isLoaded("w1"); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const state = manager.getState("w1");
    expect(state.entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(state.latestContiguousSeq).toBe(2);
    expect(state.latestKnownSeq).toBe(2);
    expect(manager.isLoaded("w1")).toBe(true);
  });

  it("dedups out-of-order wake-ups under latestContiguousSeq", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(1), entry(2), entry(3)], latestSeq: 3 },
    ]);
    await manager.ensureLoaded("w1");
    const callsBefore = requestJson.mock.calls.length;
    // Old wake-up arriving late; we already have seq=3.
    manager.onWakeUp({ workerId: "w1", seq: 2 });
    expect(requestJson.mock.calls.length).toBe(callsBefore);
  });

  it("uses snapshot seq hints to recover missed wake-up frames", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(1), entry(2)], latestSeq: 2 },
    ]);
    manager.getState("w1");

    manager.onKnownSeqs({ w1: 2 });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const state = manager.getState("w1");
    expect(state.entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(state.latestContiguousSeq).toBe(2);
    expect(state.latestKnownSeq).toBe(2);
    expect(requestJson).toHaveBeenCalledWith(
      "/api/workers/w1/entries?afterSeq=0",
      undefined,
      expect.objectContaining({ source: "Worker entries" }),
    );
  });

  it("uses selected-run snapshot seq hints even before the terminal subscribes", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(1)], latestSeq: 1 },
    ]);

    manager.onKnownSeqs({ w1: 1 });
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(manager.getState("w1").entries.map((e) => e.seq)).toEqual([1]);
    expect(requestJson).toHaveBeenCalledWith(
      "/api/workers/w1/entries?afterSeq=0",
      undefined,
      expect.objectContaining({ source: "Worker entries" }),
    );
  });

  it("onStreamResync refetches every tracked worker from its current cursor", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(1), entry(2)], latestSeq: 2 },
      { entries: [entry(1), entry(2)], latestSeq: 2 },
      { entries: [], latestSeq: 2 },
    ]);
    await manager.ensureLoaded("w1");
    await manager.ensureLoaded("w1"); // no-op when already loaded
    manager.onStreamResync();
    await new Promise((resolve) => setTimeout(resolve, 5));
    // First fetch: ensureLoaded; second fetch: resync
    expect(requestJson.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(manager.isLoaded("w1")).toBe(true);
  });

  it("subscribers receive updates on state changes", async () => {
    const { manager } = buildManager([
      { entries: [entry(1)], latestSeq: 1 },
    ]);
    const states: number[] = [];
    manager.subscribe("w1", (state) => {
      states.push(state.latestContiguousSeq);
    });
    await manager.ensureLoaded("w1");
    expect(states.at(-1)).toBe(1);
  });
});
