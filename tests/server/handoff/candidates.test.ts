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

  it("keeps useful earlier assistant context when the latest worker output is only a quota error", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "message", "Confirmed that Safari exports are falling back to the slow path.", "assistant"),
      entry(2, "message", "You've hit your session limit · resets 3:20pm", "assistant"),
    ], null);

    expect(result.recentAssistantSummary).toContain("Safari exports");
    expect(result.recentAssistantSummary).not.toContain("session limit");
  });

  it("deduplicates user messages replayed into replacement worker streams", () => {
    const first = entry(1, "user_input", "Check the export path", "user");
    const replay = { ...entry(2, "user_input", "Check the export path", "user"), id: first.id };
    const result = selectWorkerEntryCandidates([first, replay], null);

    expect(result.recentUserMessages).toEqual(["Check the export path"]);
  });
});
