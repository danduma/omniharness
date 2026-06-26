import { describe, expect, it } from "vitest";
import { derivePendingElicitationsFromWorkerEntries } from "@/app/home/worker-elicitations";
import type { WorkerEntry } from "@/server/workers/entries-types";

function entry(overrides: Partial<WorkerEntry>): WorkerEntry {
  return {
    id: overrides.id ?? "entry-1",
    seq: overrides.seq ?? 1,
    type: overrides.type ?? "elicitation",
    text: overrides.text ?? "",
    timestamp: overrides.timestamp ?? "2026-06-24T20:06:34.022Z",
    ...overrides,
  };
}

describe("derivePendingElicitationsFromWorkerEntries", () => {
  it("surfaces a pending Claude AskUserQuestion form from the unified worker stream", () => {
    const pending = derivePendingElicitationsFromWorkerEntries([
      entry({
        id: "elicitation-1",
        seq: 1576,
        status: "pending",
        raw: {
          mode: "form",
          sessionId: "claude-session",
          toolCallId: "toolu_ask",
          requestId: 1,
          message: "Please answer the following questions.",
          requestedSchema: {
            type: "object",
            properties: {
              question_0: {
                type: "string",
                title: "Entry point",
                oneOf: [{ const: "Phase 0", title: "Phase 0" }],
              },
            },
          },
        },
      }),
    ]);

    expect(pending).toEqual([{
      requestId: 1,
      requestedAt: "2026-06-24T20:06:34.022Z",
      sessionId: "claude-session",
      toolCallId: "toolu_ask",
      message: "Please answer the following questions.",
      requestedSchema: {
        type: "object",
        properties: {
          question_0: {
            type: "string",
            title: "Entry point",
            oneOf: [{ const: "Phase 0", title: "Phase 0" }],
          },
        },
      },
    }]);
  });

  it("removes a pending stream elicitation when a later terminal row has the same request id", () => {
    const pending = derivePendingElicitationsFromWorkerEntries([
      entry({
        id: "elicitation-1",
        seq: 1,
        status: "pending",
        raw: {
          requestId: 1,
          message: "Please answer.",
          requestedSchema: { type: "object", properties: {} },
        },
      }),
      entry({
        id: "elicitation-2",
        seq: 2,
        text: "Question cancelled for request 1",
        status: "cancelled",
        raw: {
          requestId: 1,
          action: "cancel",
        },
      }),
    ]);

    expect(pending).toEqual([]);
  });
});
