/**
 * End-to-end verification of the conversation storage → retrieval →
 * display pipeline for the scenario that broke run 2182b07381c8:
 *
 *   - one run, three workers (cancelled, cancelled, working)
 *   - one assistant message persisted as six growing revisions of the
 *     same entry id (live streaming)
 *   - a user_input row that landed mid-stream between two revisions
 *
 * The pipeline must render this as: prior workers' content, then the
 * coalesced assistant message at its original position, then the
 * user_input row, with no duplicates and no clustering.
 */
import { describe, expect, it } from "vitest";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { coalesceWorkerEntriesById } from "@/app/home/WorkerEntriesManager";

interface TranscriptEntry extends WorkerEntry {
  workerId: string;
}

function mergeAndSort(
  perWorker: Record<string, WorkerEntry[]>,
  workerCreationOrder: string[],
): TranscriptEntry[] {
  const merged: TranscriptEntry[] = [];
  for (const [workerId, entries] of Object.entries(perWorker)) {
    for (const entry of entries) merged.push({ ...entry, workerId });
  }
  const order = new Map(workerCreationOrder.map((id, idx) => [id, idx]));
  merged.sort((a, b) => {
    const at = Date.parse(a.timestamp) || 0;
    const bt = Date.parse(b.timestamp) || 0;
    if (at !== bt) return at - bt;
    const ao = order.get(a.workerId) ?? Number.MAX_SAFE_INTEGER;
    const bo = order.get(b.workerId) ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
  return merged;
}

describe("conversation transcript pipeline (storage → retrieval → display)", () => {
  it("renders the worker-3 sandwich correctly: revisions collapse, user_input lands between turns", () => {
    // 1. STORAGE: per-worker streams as they exist on disk.
    const w2: WorkerEntry[] = [
      { id: "w2-msg-1", seq: 1, type: "message", text: "Worker-2 starting work", timestamp: "2026-05-24T15:12:41.000Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
      { id: "w2-msg-2", seq: 2, type: "message", text: "Worker-2 finished", timestamp: "2026-05-24T15:50:32.000Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
    ];
    // worker-3's stream: 6 revisions of entry "eaa126ac" interleaved
    // with a user_input row that landed mid-stream.
    const w3: WorkerEntry[] = [
      { id: "eaa126ac", seq: 18, type: "message", text: "I have completed", timestamp: "2026-05-24T18:58:21.195Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
      { id: "eaa126ac", seq: 19, type: "message", text: "I have completed a comprehensive set", timestamp: "2026-05-24T18:58:21.195Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
      { id: "eaa126ac", seq: 20, type: "message", text: "I have completed a comprehensive set of enhancements", timestamp: "2026-05-24T18:58:21.195Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
      { id: "eaa126ac", seq: 21, type: "message", text: "I have completed a comprehensive set of enhancements to align", timestamp: "2026-05-24T18:58:21.195Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
      { id: "eaa126ac", seq: 22, type: "message", text: "I have completed a comprehensive set of enhancements to align it with the Platter Spec.", timestamp: "2026-05-24T18:58:21.195Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
      { id: "user-you-did", seq: 23, type: "user_input", text: "you did?", timestamp: "2026-05-24T18:58:24.166Z", authorRole: "user", channel: "stdin" } as WorkerEntry,
      { id: "eaa126ac", seq: 24, type: "message", text: "I have completed a comprehensive set of enhancements to align it with the Platter Spec. Let me know what's next.", timestamp: "2026-05-24T18:58:21.195Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
    ];

    // 2. RETRIEVAL: server-side merge by (timestamp, worker-order, seq).
    const merged = mergeAndSort(
      { "w2": w2, "w3": w3 },
      ["w2", "w3"],
    );

    // 3. DISPLAY: FE coalesce.
    const displayed = coalesceWorkerEntriesById(merged) as TranscriptEntry[];

    // INVARIANTS
    const ids = displayed.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids

    // The 6 revisions collapsed into 1 row, with the LATEST text.
    const finalAssistant = displayed.find((e) => e.id === "eaa126ac")!;
    expect(finalAssistant).toBeDefined();
    expect(finalAssistant.text).toContain("Let me know what's next.");
    expect(displayed.filter((e) => e.id === "eaa126ac")).toHaveLength(1);

    // Chronological order: worker-2 work → worker-3 message → user input
    const positions = {
      w2_first: displayed.findIndex((e) => e.id === "w2-msg-1"),
      w2_done: displayed.findIndex((e) => e.id === "w2-msg-2"),
      asst: displayed.findIndex((e) => e.id === "eaa126ac"),
      user: displayed.findIndex((e) => e.id === "user-you-did"),
    };
    expect(positions.w2_first).toBeLessThan(positions.w2_done);
    expect(positions.w2_done).toBeLessThan(positions.asst);
    expect(positions.asst).toBeLessThan(positions.user);
  });

  it("preserves user→assistant pairing across multiple worker generations", () => {
    // User sends 2 messages. Worker-1 handles #1, gets cancelled,
    // worker-2 handles #2. Both workers' content must appear in the
    // right slots.
    const w1: WorkerEntry[] = [
      { id: "u1", seq: 1, type: "user_input", text: "first ask", timestamp: "2026-05-24T10:00:00.000Z", authorRole: "user", channel: "stdin" } as WorkerEntry,
      { id: "a1", seq: 2, type: "message", text: "first answer", timestamp: "2026-05-24T10:01:00.000Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
    ];
    const w2: WorkerEntry[] = [
      { id: "u2", seq: 1, type: "user_input", text: "second ask", timestamp: "2026-05-24T11:00:00.000Z", authorRole: "user", channel: "stdin" } as WorkerEntry,
      { id: "a2", seq: 2, type: "message", text: "second answer", timestamp: "2026-05-24T11:01:00.000Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
    ];

    const merged = mergeAndSort({ w1, w2 }, ["w1", "w2"]);
    const displayed = coalesceWorkerEntriesById(merged) as TranscriptEntry[];

    expect(displayed.map((e) => e.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });

  it("does not cluster late-appended user_inputs at the end", () => {
    // Bug we hit: while worker is producing seqs 1..50, the user sends
    // a message. user_input row lands at seq 51 (last in seq order)
    // but its TIMESTAMP is earlier than half the assistant content.
    const w: WorkerEntry[] = [
      { id: "a-early", seq: 1, type: "message", text: "early thought", timestamp: "2026-05-24T10:00:00.000Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
      { id: "u-mid", seq: 51, type: "user_input", text: "wait, do this instead", timestamp: "2026-05-24T10:00:30.000Z", authorRole: "user", channel: "stdin" } as WorkerEntry,
      { id: "a-late", seq: 52, type: "message", text: "ok pivoting", timestamp: "2026-05-24T10:01:00.000Z", authorRole: "assistant", channel: "agent" } as WorkerEntry,
    ];

    // Single-worker case: the worker stream's seq order matches the
    // intended display order, so seq-based sorting suffices.
    const displayed = coalesceWorkerEntriesById(w);
    expect(displayed.map((e) => e.id)).toEqual(["a-early", "u-mid", "a-late"]);
  });
});
