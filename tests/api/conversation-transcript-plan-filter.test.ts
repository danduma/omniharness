import { describe, expect, it } from "vitest";
import { __testInternals } from "@/runtime/http/routes/conversation-transcript";
import type { WorkerEntry } from "@/shared/worker-entries";

describe("conversation transcript plan diagnostics", () => {
  it("excludes diagnostic rows while leaving accepted plan rows for owner-aware projection", () => {
    const entries: WorkerEntry[] = [
      { id: "boundary", seq: 1, type: "system_note", text: "", timestamp: "2026-01-01T00:00:00.000Z", diagnosticOnly: true, planProjection: "session_reset" },
      { id: "accepted", seq: 2, type: "plan", text: "Inspect", timestamp: "2026-01-01T00:00:01.000Z", planProjection: "accepted_core" },
      { id: "message", seq: 3, type: "message", text: "Working", timestamp: "2026-01-01T00:00:02.000Z" },
    ];

    expect(__testInternals.excludeDiagnosticEntries(entries).map((entry) => entry.id)).toEqual([
      "accepted",
      "message",
    ]);
  });
});
