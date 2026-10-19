import { describe, expect, it } from "vitest";
import { __testInternals } from "@/runtime/http/routes/conversation-transcript";
import type { WorkerEntry } from "@/shared/worker-entries";

function entriesAt(prefix: string, startSeq: number, count: number, startMs: number, stepMs = 1000): WorkerEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${startSeq + index}`,
    seq: startSeq + index,
    type: "tool_call_update",
    text: "",
    timestamp: new Date(startMs + index * stepMs).toISOString(),
  }));
}

const order = new Map([["w1", 0], ["w2", 1]]);
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-10-17T21:00:00.000Z");

describe("conversation transcript tail across workers", () => {
  it("keeps the newest entries overall instead of a tail from every worker", () => {
    // w1 stopped days ago; w2 is the active worker with far more history.
    const w1 = entriesAt("w1", 901, 100, T0);
    const w2 = entriesAt("w2", 4901, 100, T0 + 2 * DAY);

    const { kept, oldestCursors, hasOlder } = __testInternals.takeNewestAcrossWorkers([
      { workerId: "w1", entries: w1, hasOlder: true, upperCursor: 1001 },
      { workerId: "w2", entries: w2, hasOlder: true, upperCursor: 5001 },
    ], 100, order);

    expect(kept.get("w1")).toEqual([]);
    expect(kept.get("w2")?.map((entry) => entry.seq)).toEqual(w2.map((entry) => entry.seq));
    // w1 contributed nothing, so scroll-back must still start at its newest entry.
    expect(oldestCursors).toEqual({ w1: 1001, w2: 4901 });
    expect(hasOlder).toBe(true);
  });

  it("splits the page by time and keeps each worker's slice contiguous", () => {
    const w1 = entriesAt("w1", 1, 6, T0, 2000);
    const w2 = entriesAt("w2", 1, 6, T0 + 1000, 2000);

    const { kept, oldestCursors, hasOlder } = __testInternals.takeNewestAcrossWorkers([
      { workerId: "w1", entries: w1, hasOlder: false, upperCursor: 7 },
      { workerId: "w2", entries: w2, hasOlder: false, upperCursor: 7 },
    ], 4, order);

    expect(kept.get("w1")?.map((entry) => entry.seq)).toEqual([5, 6]);
    expect(kept.get("w2")?.map((entry) => entry.seq)).toEqual([5, 6]);
    expect(oldestCursors).toEqual({ w1: 5, w2: 5 });
    expect(hasOlder).toBe(true);
  });

  it("does not cut through a run of streamed message fragments", () => {
    const fragments: WorkerEntry[] = ["The", " plan", " is", " final"].map((text, index) => ({
      id: `frag-${index + 1}`,
      seq: index + 1,
      type: "message",
      text,
      timestamp: new Date(T0 + index * 1000).toISOString(),
    }));

    const { kept, oldestCursors, hasOlder } = __testInternals.takeNewestAcrossWorkers([
      { workerId: "w1", entries: fragments, hasOlder: false, upperCursor: 5 },
    ], 2, order);

    expect(kept.get("w1")?.map((entry) => entry.seq)).toEqual([1, 2, 3, 4]);
    expect(oldestCursors).toEqual({ w1: 1 });
    expect(hasOlder).toBe(false);
  });

  it("reports nothing older once every worker's page fits", () => {
    const { kept, hasOlder } = __testInternals.takeNewestAcrossWorkers([
      { workerId: "w1", entries: entriesAt("w1", 1, 3, T0), hasOlder: false, upperCursor: 4 },
      { workerId: "w2", entries: [], hasOlder: false, upperCursor: 1 },
    ], 100, order);

    expect(kept.get("w1")).toHaveLength(3);
    expect(hasOlder).toBe(false);
  });
});
