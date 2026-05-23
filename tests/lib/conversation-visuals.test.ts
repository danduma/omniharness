import { describe, expect, it } from "vitest";
import { getConversationVisualKind } from "@/lib/conversation-visuals";

describe("getConversationVisualKind", () => {
  it("treats implementation and planning conversations as supervisor-driven", () => {
    expect(getConversationVisualKind({ id: "run-1", mode: "implementation" })).toBe("supervisor");
    expect(getConversationVisualKind({ id: "run-2", mode: "planning" })).toBe("supervisor");
  });

  it("treats normal direct conversations as direct control", () => {
    expect(getConversationVisualKind({ id: "run-1", mode: "direct", title: "Debug CSS" })).toBe("direct");
  });

  it("does not infer commit conversations from title text", () => {
    expect(getConversationVisualKind({ id: "run-1", mode: "direct", title: "Commit sidebar follow-up" })).toBe("direct");
  });

  it("does not infer commit conversations from user messages", () => {
    expect(getConversationVisualKind({ id: "run-1", mode: "direct", title: "Commit" })).toBe("direct");
  });

  it("detects project auto-commit conversations from explicit initial mode", () => {
    expect(getConversationVisualKind(
      { id: "run-1", mode: "commit", title: "New conversation" },
    )).toBe("commit");
  });
});
