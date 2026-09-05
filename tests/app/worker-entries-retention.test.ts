import { describe, expect, it, vi } from "vitest";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { WorkerEntriesManager } from "@/interface/home/WorkerEntriesManager";
import type { EntryRetentionPolicy } from "@/interface/home/entry-retention";

const RETENTION: EntryRetentionPolicy = {
  hotWindow: 4,
  maxRetained: 12,
  scrollbackIdleMs: 1_000,
};

function entry(seq: number): WorkerEntry {
  return {
    id: `e-${seq}`,
    seq,
    type: "message",
    text: `m${seq}`,
    timestamp: new Date(1700000000000 + seq).toISOString(),
  };
}

function range(from: number, to: number): WorkerEntry[] {
  const entries: WorkerEntry[] = [];
  for (let seq = from; seq <= to; seq += 1) {
    entries.push(entry(seq));
  }
  return entries;
}

/**
 * A worker that keeps streaming: each call returns the next page of entries
 * after the requested cursor, exactly as the live stream does.
 */
function streamingManager(options: { now?: () => number; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 5;
  let produced = 0;
  const listEntries = vi.fn(async (input: { afterSeq?: number; beforeSeq?: number; limit?: number }) => {
    if (input.beforeSeq !== undefined) {
      // Older page: the entries directly below the current window.
      const to = input.beforeSeq - 1;
      const from = Math.max(1, to - (input.limit ?? pageSize) + 1);
      return {
        entries: to >= 1 ? range(from, to) : [],
        latestSeq: produced,
        hasOlder: from > 1,
      };
    }
    if (input.afterSeq === undefined) {
      produced = pageSize;
      return { entries: range(1, pageSize), latestSeq: pageSize };
    }
    const from = produced + 1;
    produced += pageSize;
    return { entries: range(from, produced), latestSeq: produced };
  });
  const manager = new WorkerEntriesManager({
    listEntries: listEntries as never,
    now: options.now,
    retention: RETENTION,
  });
  return { manager, listEntries };
}

describe("WorkerEntriesManager retention", () => {
  it("garbage collects the head as a long-running stream appends", async () => {
    const { manager } = streamingManager();
    manager.subscribe("w1", () => {});

    await manager.ensureLoaded("w1");
    for (let round = 0; round < 6; round += 1) {
      await manager.refresh("w1");
    }

    const state = manager.getState("w1");
    // Without the collector this window would hold all 35 entries.
    expect(state.entries.length).toBeLessThanOrEqual(RETENTION.hotWindow);
    expect(state.entries.at(-1)?.seq).toBe(35);
    // The cursor still tracks the newest entry, so forward fetches continue
    // from the right place after a trim.
    expect(state.latestContiguousSeq).toBe(35);
  });

  it("reports older entries as available once it has dropped some", async () => {
    const { manager } = streamingManager();
    manager.subscribe("w1", () => {});

    await manager.ensureLoaded("w1");
    expect(manager.getState("w1").hasOlder).toBe(false);

    await manager.refresh("w1");
    const state = manager.getState("w1");
    expect(state.hasOlder).toBe(true);
    // lowestSeq must follow the trim, otherwise scroll-back refetches a page
    // the window already contains.
    expect(state.lowestSeq).toBe(state.entries[0]?.seq);
  });

  it("keeps scroll-back history while the reader is still using it", async () => {
    let clock = 10_000;
    const { manager } = streamingManager({ now: () => clock });
    manager.subscribe("w1", () => {});

    await manager.ensureLoaded("w1");
    await manager.refresh("w1");
    // Reaching the top of the viewport raises the ceiling.
    await manager.loadOlder("w1");

    await manager.refresh("w1");
    expect(manager.getState("w1").entries.length).toBeGreaterThan(RETENTION.hotWindow);

    // Once the reader stops scrolling back, the window collapses again.
    clock += RETENTION.scrollbackIdleMs + 1;
    await manager.refresh("w1");
    expect(manager.getState("w1").entries.length).toBeLessThanOrEqual(RETENTION.hotWindow);
  });

  it("collapses a stream to the hot window once nothing renders it", async () => {
    let clock = 10_000;
    const { manager } = streamingManager({ now: () => clock });
    const unsubscribe = manager.subscribe("w1", () => {});

    await manager.ensureLoaded("w1");
    await manager.refresh("w1");
    await manager.loadOlder("w1");
    await manager.refresh("w1");
    expect(manager.getState("w1").entries.length).toBeGreaterThan(RETENTION.hotWindow);

    unsubscribe();

    const state = manager.getState("w1");
    expect(state.entries.length).toBe(RETENTION.hotWindow);
    expect(state.hasOlder).toBe(true);
  });

  it("preserves the entries array identity when a poll appends nothing", async () => {
    const listEntries = vi.fn(async () => ({ entries: range(1, 3), latestSeq: 3 }));
    const manager = new WorkerEntriesManager({
      listEntries: listEntries as never,
      retention: RETENTION,
    });
    manager.subscribe("w1", () => {});

    await manager.ensureLoaded("w1");
    const first = manager.getState("w1").entries;
    await manager.refresh("w1");

    expect(manager.getState("w1").entries).toBe(first);
  });
});
