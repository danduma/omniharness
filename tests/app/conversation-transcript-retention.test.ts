import { describe, expect, it, vi } from "vitest";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { ConversationTranscriptManager } from "@/interface/home/ConversationTranscriptManager";
import { decodeConversationTranscriptToken, encodeConversationTranscriptToken } from "@/shared/conversation-transcript-token";
import type { EntryRetentionPolicy } from "@/interface/home/entry-retention";

const RETENTION: EntryRetentionPolicy = {
  hotWindow: 4,
  maxRetained: 12,
  scrollbackIdleMs: 1_000,
};

function entry(seq: number, workerId = "w1"): WorkerEntry & { workerId: string } {
  return {
    id: `${workerId}-entry-${seq}`,
    workerId,
    seq,
    type: "message",
    text: `message ${seq}`,
    timestamp: new Date(1700000000000 + seq).toISOString(),
  } as WorkerEntry & { workerId: string };
}

function range(from: number, to: number, workerId = "w1") {
  const entries = [];
  for (let seq = from; seq <= to; seq += 1) {
    entries.push(entry(seq, workerId));
  }
  return entries;
}

describe("ConversationTranscriptManager retention", () => {
  it("garbage collects the head as a long-running conversation streams", async () => {
    let produced = 0;
    const transcript = vi.fn(async () => {
      const from = produced + 1;
      produced += 5;
      return {
        entries: range(from, produced),
        latestToken: `latest-${produced}`,
        oldestToken: encodeConversationTranscriptToken({ cursors: { w1: 1 } }),
        hasOlder: false,
        workerIds: ["w1"],
      };
    });
    const manager = new ConversationTranscriptManager({
      transcript: transcript as never,
      retention: RETENTION,
    });
    manager.subscribe("run-1", () => {});

    await manager.ensureLoaded("run-1");
    for (let round = 0; round < 5; round += 1) {
      await manager.refresh("run-1");
    }

    const state = manager.getState("run-1");
    // Without the collector this window would hold all 30 entries.
    expect(state.entries.length).toBeLessThanOrEqual(RETENTION.hotWindow);
    expect(state.entries.at(-1)?.seq).toBe(30);
    expect(state.hasOlder).toBe(true);
  });

  it("mints an oldest cursor that reaches the entries it just dropped", async () => {
    let produced = 0;
    const transcript = vi.fn(async () => {
      const from = produced + 1;
      produced += 6;
      return {
        entries: range(from, produced),
        latestToken: `latest-${produced}`,
        // The server's cursor describes the window it handed us, not the one
        // we keep after collection.
        oldestToken: encodeConversationTranscriptToken({ cursors: { w1: from } }),
        hasOlder: from > 1,
        workerIds: ["w1"],
      };
    });
    const manager = new ConversationTranscriptManager({
      transcript: transcript as never,
      retention: RETENTION,
    });
    manager.subscribe("run-1", () => {});

    await manager.ensureLoaded("run-1");
    await manager.refresh("run-1");

    const state = manager.getState("run-1");
    const lowestRetained = state.entries[0]!.seq;
    const cursors = decodeConversationTranscriptToken(state.oldestToken).cursors;
    // `beforeToken` is exclusive, so the cursor must sit exactly at the lowest
    // entry still in memory: one lower would refetch a row we already have,
    // one higher would skip a dropped row forever.
    expect(cursors.w1).toBe(lowestRetained);
  });

  it("keeps a worker whose entries were all dropped reachable", async () => {
    let call = 0;
    const transcript = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          entries: [...range(1, 3, "w1"), ...range(1, 3, "w2")],
          latestToken: "latest-1",
          oldestToken: encodeConversationTranscriptToken({ cursors: { w1: 1, w2: 1 } }),
          hasOlder: false,
          workerIds: ["w1", "w2"],
        };
      }
      return {
        entries: range(4, 9, "w2"),
        latestToken: `latest-${call}`,
        oldestToken: encodeConversationTranscriptToken({ cursors: { w2: 4 } }),
        hasOlder: false,
        workerIds: ["w1", "w2"],
      };
    });
    const manager = new ConversationTranscriptManager({
      transcript: transcript as never,
      retention: RETENTION,
    });
    manager.subscribe("run-1", () => {});

    await manager.ensureLoaded("run-1");
    await manager.refresh("run-1");

    const state = manager.getState("run-1");
    expect(state.entries.every((item) => item.workerId === "w2")).toBe(true);
    const cursors = decodeConversationTranscriptToken(state.oldestToken).cursors;
    // w1 left the window entirely; its cursor must sit above its highest
    // dropped seq so scroll-back can still bring those rows back.
    expect(cursors.w1).toBe(4);
  });

  it("collapses to the hot window once nothing renders the run", async () => {
    let produced = 0;
    const transcript = vi.fn(async () => {
      const from = produced + 1;
      produced += 6;
      return {
        entries: range(from, produced),
        latestToken: `latest-${produced}`,
        oldestToken: encodeConversationTranscriptToken({ cursors: { w1: from } }),
        hasOlder: true,
        workerIds: ["w1"],
      };
    });
    let clock = 10_000;
    const manager = new ConversationTranscriptManager({
      transcript: transcript as never,
      retention: RETENTION,
      now: () => clock,
    });
    const unsubscribe = manager.subscribe("run-1", () => {});

    await manager.ensureLoaded("run-1");
    await manager.loadOlder("run-1");
    await manager.refresh("run-1");
    expect(manager.getState("run-1").entries.length).toBeGreaterThan(RETENTION.hotWindow);

    unsubscribe();
    expect(manager.getState("run-1").entries.length).toBe(RETENTION.hotWindow);
  });

  it("preserves the entries array identity when a poll appends nothing", async () => {
    const transcript = vi.fn(async () => ({
      entries: range(1, 3),
      latestToken: "latest",
      oldestToken: encodeConversationTranscriptToken({ cursors: { w1: 1 } }),
      hasOlder: false,
      workerIds: ["w1"],
    }));
    const manager = new ConversationTranscriptManager({
      transcript: transcript as never,
      retention: RETENTION,
    });
    manager.subscribe("run-1", () => {});

    await manager.ensureLoaded("run-1");
    const first = manager.getState("run-1").entries;
    await manager.refresh("run-1");

    expect(manager.getState("run-1").entries).toBe(first);
  });
});

describe("conversation transcript token codec", () => {
  it("round-trips cursors", () => {
    const encoded = encodeConversationTranscriptToken({ cursors: { w1: 12, w2: 3 } });
    expect(decodeConversationTranscriptToken(encoded).cursors).toEqual({ w1: 12, w2: 3 });
  });

  it("decodes tokens minted by the server's base64url encoding", () => {
    const serverToken = Buffer.from(JSON.stringify({ cursors: { w1: 7 } }), "utf8").toString("base64url");
    expect(decodeConversationTranscriptToken(serverToken).cursors).toEqual({ w1: 7 });
  });

  it("treats a malformed token as a cold start", () => {
    expect(decodeConversationTranscriptToken("not-a-token").cursors).toEqual({});
    expect(decodeConversationTranscriptToken(null).cursors).toEqual({});
  });
});
