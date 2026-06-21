import { describe, expect, it, vi } from "vitest";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { ConversationTranscriptManager } from "@/app/home/ConversationTranscriptManager";

function token(label: string) {
  return Buffer.from(JSON.stringify({ label }), "utf8").toString("base64url");
}

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

describe("ConversationTranscriptManager", () => {
  it("tail-loads the selected run and prepends older pages on scroll-back", async () => {
    const tailToken = token("tail");
    const oldestToken = token("oldest");
    const olderOldestToken = token("older-oldest");
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [entry(152), entry(153)],
        latestToken: tailToken,
        oldestToken,
        hasOlder: true,
        workerIds: ["w1"],
      })
      .mockResolvedValueOnce({
        entries: [entry(150), entry(151)],
        latestToken: tailToken,
        oldestToken: olderOldestToken,
        hasOlder: true,
        workerIds: ["w1"],
      });
    const manager = new ConversationTranscriptManager({
      requestJson: requestJson as unknown as never,
    });

    await manager.ensureLoaded("run-1");

    expect(requestJson).toHaveBeenCalledWith(
      "/api/conversations/run-1/transcript?limit=100",
      undefined,
      expect.objectContaining({ action: "Load conversation transcript" }),
    );
    expect(manager.getState("run-1")).toMatchObject({
      entries: [{ seq: 152 }, { seq: 153 }],
      latestToken: tailToken,
      oldestToken,
      hasOlder: true,
      status: "loaded",
    });

    await manager.loadOlder("run-1");

    expect(requestJson).toHaveBeenLastCalledWith(
      `/api/conversations/run-1/transcript?beforeToken=${encodeURIComponent(oldestToken)}&limit=100`,
      undefined,
      expect.objectContaining({ action: "Load older conversation transcript" }),
    );
    expect(manager.getState("run-1")).toMatchObject({
      entries: [{ seq: 150 }, { seq: 151 }, { seq: 152 }, { seq: 153 }],
      latestToken: tailToken,
      oldestToken: olderOldestToken,
      hasOlder: true,
      status: "loaded",
    });
  });
});
