import { describe, expect, it, vi } from "vitest";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { EMPTY_WORKER_STREAM_STATE, WorkerEntriesManager, coalesceWorkerEntriesById } from "@/interface/home/WorkerEntriesManager";

describe("coalesceWorkerEntriesById", () => {
  function asst(seq: number, text: string, id = "msg", timestamp = "2026-01-01T00:00:00.000Z"): WorkerEntry {
    return { id, seq, type: "message", text, timestamp, authorRole: "assistant", channel: "agent" } as WorkerEntry;
  }
  function user(seq: number, text: string, id = `user-${seq}`, timestamp = "2026-01-01T00:00:05.000Z"): WorkerEntry {
    return { id, seq, type: "user_input", text, timestamp, authorRole: "user", channel: "stdin" } as WorkerEntry;
  }

  it("keeps a single row per id at its first appearance, with the latest text", () => {
    const out = coalesceWorkerEntriesById([
      asst(1, "Hello"),
      user(2, "your message"),
      asst(3, "Hello world"),
    ]);
    expect(out.map((e) => ({ id: e.id, seq: e.seq, text: e.text }))).toEqual([
      { id: "msg", seq: 3, text: "Hello world" },
      { id: "user-2", seq: 2, text: "your message" },
    ]);
  });

  it("places a re-delivered message where the newest worker has it", () => {
    // A rewind re-delivers the message on a new worker with a new timestamp.
    // That copy is the live one; the older worker's copy belongs to the branch
    // the user discarded.
    const out = coalesceWorkerEntriesById([
      { ...user(695, "the question", "edited", "2026-07-25T09:36:34.136Z"), workerId: "run-worker-1" } as WorkerEntry,
      { ...user(2, "the question", "edited", "2026-07-25T10:06:43.720Z"), workerId: "run-worker-2" } as WorkerEntry,
    ], ["run-worker-1", "run-worker-2"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "edited", timestamp: "2026-07-25T10:06:43.720Z" });
  });

  it("keeps history backfilled onto a newer worker at its original send time", () => {
    // `reconcileWorkerUserMessagesInStream` replays old messages onto a fresh
    // worker using the original createdAt. The opening prompt must stay at the
    // top of the conversation, not move to whenever the replay ran.
    const out = coalesceWorkerEntriesById([
      { ...user(1, "opening prompt", "first", "2026-05-24T12:06:59.692Z"), workerId: "run-worker-1" } as WorkerEntry,
      { ...user(220, "opening prompt", "first", "2026-05-24T15:28:06.421Z"), workerId: "run-worker-2" } as WorkerEntry,
      { ...user(25, "opening prompt", "first", "2026-05-24T12:06:59.000Z"), workerId: "run-worker-3" } as WorkerEntry,
    ], ["run-worker-1", "run-worker-2", "run-worker-3"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "first", timestamp: "2026-05-24T12:06:59.000Z" });
  });

  it("keeps the earliest timestamp when there is no worker order to judge by", () => {
    const out = coalesceWorkerEntriesById([
      user(695, "the question", "edited", "2026-07-25T09:36:34.136Z"),
      user(2, "the question", "edited", "2026-07-25T10:06:43.720Z"),
    ]);
    expect(out[0]).toMatchObject({ id: "edited", timestamp: "2026-07-25T09:36:34.136Z" });
  });

  it("preserves entries without an id verbatim", () => {
    const noId = { seq: 5, type: "message", text: "synthetic" } as WorkerEntry;
    const out = coalesceWorkerEntriesById([asst(1, "first"), noId, asst(2, "second")]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "msg", text: "second" });
    expect(out[1]).toBe(noId);
  });

  it("handles the worker-3 sandwich case (asst@22 → user@23 → asst@24 with same id)", () => {
    const out = coalesceWorkerEntriesById([
      asst(22, "I have completed a comprehensive…", "asst-1", "2026-05-24T18:58:21.195Z"),
      user(23, "you did?", "u-23", "2026-05-24T18:58:24.166Z"),
      asst(24, "I have completed a comprehensive set of enhancements…", "asst-1", "2026-05-24T18:58:21.195Z"),
    ]);
    expect(out.map((e) => e.id)).toEqual(["asst-1", "u-23"]);
    expect(out[0]?.seq).toBe(24);
    expect(out[0]?.text).toBe("I have completed a comprehensive set of enhancements…");
  });

  it("returns an empty array for empty input", () => {
    expect(coalesceWorkerEntriesById([])).toEqual([]);
  });
});

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
  const listEntries = vi.fn(async () => {
    const response = responses[call] ?? responses[responses.length - 1];
    call += 1;
    return response;
  });
  const manager = new WorkerEntriesManager({ listEntries });
  return { manager, requestJson: listEntries };
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
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

  it("hydrates a worker stream from the frontend cache, then validates the tail against the server", async () => {
    const storage = memoryStorage();
    const first = new WorkerEntriesManager({ storage });
    first.getState("w1", [entry(1), entry(2)]);
    // Cache writes are coalesced onto a trailing timer so they cannot block
    // the main thread on every appended entry; a reload flushes via pagehide.
    first.flushCache();

    const requestJson = vi.fn(async () => ({ entries: [entry(2), entry(3)], latestSeq: 3 }));
    const second = new WorkerEntriesManager({
      listEntries: requestJson,
      storage,
    });

    const cached = second.getState("w1");

    expect(cached.entries.map((item) => item.seq)).toEqual([1, 2]);
    expect(cached.status).toBe("loaded");
    expect(second.isLoaded("w1")).toBe(false);

    await second.ensureLoaded("w1");
    expect(requestJson).toHaveBeenCalledWith({ workerId: "w1", limit: 100 });
    expect(second.getState("w1").entries.map((item) => item.seq)).toEqual([2, 3]);
    expect(second.isLoaded("w1")).toBe(true);
  });

  it("clears stale cached entries when the authoritative worker stream is empty", async () => {
    const storage = memoryStorage();
    const first = new WorkerEntriesManager({ storage });
    first.getState("w1", [entry(1), entry(2)]);
    first.flushCache();

    const requestJson = vi.fn(async () => ({ entries: [], latestSeq: 0 }));
    const second = new WorkerEntriesManager({
      listEntries: requestJson,
      storage,
    });

    expect(second.getState("w1").entries.map((item) => item.seq)).toEqual([1, 2]);

    await second.ensureLoaded("w1");

    expect(second.getState("w1")).toMatchObject({
      entries: [],
      latestContiguousSeq: 0,
      latestKnownSeq: 0,
      status: "loaded",
    });

    second.flushCache();
    const third = new WorkerEntriesManager({
      listEntries: requestJson,
      storage,
    });
    expect(third.getState("w1").entries).toEqual([]);
  });

  it("refresh revalidates a loaded worker stream from the current cursor", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(3)], latestSeq: 3 },
    ]);
    manager.getState("w1", [entry(1), entry(2)]);

    await manager.refresh("w1");

    expect(manager.getState("w1").entries.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(manager.getState("w1").latestContiguousSeq).toBe(3);
    expect(requestJson).toHaveBeenCalledWith({ workerId: "w1", afterSeq: 2 });
  });

  it("keeps the entries array identity when a poll appends nothing", async () => {
    // Consumers memoize off this array: ConversationMain's transcript merge
    // and, through it, Terminal's activity rebuild (~3ms on a 2k-entry
    // conversation, several times that on a phone). Handing back a fresh
    // array for a byte-identical result re-ran both on every idle poll.
    const { manager } = buildManager([{ entries: [], latestSeq: 2 }]);
    manager.getState("w1", [entry(1), entry(2)]);
    const beforeEntries = manager.getState("w1").entries;

    await manager.refresh("w1");

    expect(manager.getState("w1").entries).toBe(beforeEntries);
  });

  it("publishes a new entries array when a poll actually appends", async () => {
    const { manager } = buildManager([{ entries: [entry(3)], latestSeq: 3 }]);
    manager.getState("w1", [entry(1), entry(2)]);
    const beforeEntries = manager.getState("w1").entries;

    await manager.refresh("w1");

    expect(manager.getState("w1").entries).not.toBe(beforeEntries);
    expect(manager.getState("w1").entries.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it("refresh revalidates a loaded empty worker stream and pulls later disk output", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [], latestSeq: 0 },
      { entries: [entry(1), entry(2)], latestSeq: 2 },
    ]);

    await manager.ensureLoaded("w1");
    expect(manager.getState("w1")).toMatchObject({
      entries: [],
      latestContiguousSeq: 0,
      latestKnownSeq: 0,
      status: "loaded",
    });

    await manager.refresh("w1");

    expect(manager.getState("w1").entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(manager.getState("w1").latestKnownSeq).toBe(2);
    expect(requestJson).toHaveBeenLastCalledWith({ workerId: "w1", afterSeq: 0 });
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

  it("revalidates a previously empty loaded stream when a worker is subscribed again", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [], latestSeq: 0 },
      { entries: [entry(1), entry(2)], latestSeq: 2 },
    ]);

    await manager.ensureLoaded("w1");
    expect(manager.getState("w1")).toMatchObject({
      latestContiguousSeq: 0,
      latestKnownSeq: 0,
      status: "loaded",
    });

    await manager.ensureLoaded("w1");

    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(manager.getState("w1").entries.map((e) => e.seq)).toEqual([1, 2]);
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
    expect(requestJson).toHaveBeenLastCalledWith({ workerId: "w1", afterSeq: 1 });
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
    const manager = new WorkerEntriesManager({ listEntries: requestJson });

    const initialLoad = manager.ensureLoaded("w1");
    expect(requestJson).toHaveBeenCalledWith({ workerId: "w1", limit: 100 });

    manager.onWakeUp({ workerId: "w1", seq: 2 });
    first.resolve({ entries: [], latestSeq: 0 });
    await initialLoad;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestJson).toHaveBeenCalledTimes(2);
    // After the empty tail load, a wake-up triggered forward extension
    // from latestContiguousSeq=0.
    expect(requestJson).toHaveBeenLastCalledWith({ workerId: "w1", afterSeq: 0 });

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

  it("retries when a lower missing seq wake-up arrives during an in-flight gap fetch", async () => {
    const first = deferred<{ entries: WorkerEntry[]; latestSeq: number }>();
    const second = deferred<{ entries: WorkerEntry[]; latestSeq: number }>();
    const requestJson = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const manager = new WorkerEntriesManager({ listEntries: requestJson });

    manager.onWakeUp({ workerId: "w1", seq: 2 });
    expect(requestJson).toHaveBeenCalledWith({ workerId: "w1", afterSeq: 0 });

    manager.onWakeUp({ workerId: "w1", seq: 1 });
    first.resolve({ entries: [entry(2)], latestSeq: 2 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(requestJson).toHaveBeenLastCalledWith({ workerId: "w1", afterSeq: 0 });

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
    expect(requestJson).toHaveBeenCalledWith({ workerId: "w1", afterSeq: 0 });
  });

  it("uses selected-run snapshot seq hints even before the terminal subscribes", async () => {
    const { manager, requestJson } = buildManager([
      { entries: [entry(1)], latestSeq: 1 },
    ]);

    manager.onKnownSeqs({ w1: 1 });
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(manager.getState("w1").entries.map((e) => e.seq)).toEqual([1]);
    expect(requestJson).toHaveBeenCalledWith({ workerId: "w1", afterSeq: 0 });
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

describe("WorkerEntriesManager.hasEverLoaded", () => {
  it("latches true across wake-up catch-up fetches", async () => {
    const gate = deferred<{ entries: WorkerEntry[]; latestSeq: number }>();
    let call = 0;
    const listEntries = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve({ entries: [entry(1)], latestSeq: 1 });
      }
      return gate.promise;
    });
    const manager = new WorkerEntriesManager({ listEntries });

    expect(manager.hasEverLoaded("w1")).toBe(false);
    await manager.ensureLoaded("w1");
    expect(manager.isLoaded("w1")).toBe(true);
    expect(manager.hasEverLoaded("w1")).toBe(true);

    // A wake-up hint advances latestKnownSeq and starts a catch-up fetch;
    // isLoaded drops until the gap closes, but hasEverLoaded must not.
    manager.onWakeUp({ workerId: "w1", seq: 2 });
    expect(manager.isLoaded("w1")).toBe(false);
    expect(manager.hasEverLoaded("w1")).toBe(true);

    gate.resolve({ entries: [entry(2)], latestSeq: 2 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(manager.isLoaded("w1")).toBe(true);
    expect(manager.hasEverLoaded("w1")).toBe(true);
  });

  it("stays false for cache-hydrated entries until the tail is validated", async () => {
    const storage = memoryStorage();
    storage.setItem("omni-worker-entries-cache:v2", JSON.stringify({
      version: 1,
      workers: { w1: { updatedAt: 1, entries: [entry(1)] } },
    }));
    const manager = new WorkerEntriesManager({
      listEntries: vi.fn(async () => ({ entries: [entry(1)], latestSeq: 1 })),
      storage,
    });

    expect(manager.getState("w1").needsTailValidation).toBe(true);
    expect(manager.hasEverLoaded("w1")).toBe(false);

    await manager.ensureLoaded("w1");
    expect(manager.hasEverLoaded("w1")).toBe(true);
  });
});
