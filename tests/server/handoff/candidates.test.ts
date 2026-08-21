import { describe, expect, it } from "vitest";
import { selectWorkerEntryCandidates } from "@/server/handoff/candidates";
import type { WorkerEntry } from "@/shared/worker-entries";

function entry(seq: number, type: WorkerEntry["type"], text: string, authorRole?: WorkerEntry["authorRole"]): WorkerEntry {
  return { id: `e-${seq}`, seq, type, text, timestamp: new Date(seq * 1_000).toISOString(), authorRole };
}

describe("selectWorkerEntryCandidates", () => {
  it("excludes hidden reasoning and bounds entries at the requested source sequence", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "user_input", "original", "user"),
      entry(2, "thought", "private reasoning", "assistant"),
      entry(3, "message", "assistant recap", "assistant"),
      entry(4, "tool_call_update", "tests passed", "assistant"),
      entry(5, "message", "later answer", "assistant"),
    ], 4);

    expect(result.recentUserMessages).toEqual(["original"]);
    expect(result.recentAssistantSummary).toBe("assistant recap");
    expect(result.verificationText).toContain("tests passed");
    expect(JSON.stringify(result)).not.toContain("private reasoning");
    expect(JSON.stringify(result)).not.toContain("later answer");
  });
});
