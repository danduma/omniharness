import { describe, expect, it } from "vitest";
import { AUTO_COMMIT_PROJECT_PROMPT, getConversationVisualKind } from "@/lib/conversation-visuals";

describe("getConversationVisualKind", () => {
  it("treats implementation and planning conversations as supervisor-driven", () => {
    expect(getConversationVisualKind({ id: "run-1", mode: "implementation" })).toBe("supervisor");
    expect(getConversationVisualKind({ id: "run-2", mode: "planning" })).toBe("supervisor");
  });

  it("treats normal direct conversations as direct control", () => {
    expect(getConversationVisualKind({ id: "run-1", mode: "direct", title: "Debug CSS" })).toBe("direct");
  });

  it("detects project auto-commit direct conversations from the initial message", () => {
    expect(getConversationVisualKind(
      { id: "run-1", mode: "direct", title: "New conversation" },
      [
        {
          runId: "run-1",
          role: "user",
          content: AUTO_COMMIT_PROJECT_PROMPT,
          createdAt: "2026-05-09T04:10:42.701Z",
        },
      ],
    )).toBe("commit");
  });
});
