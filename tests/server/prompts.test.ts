import { describe, expect, it } from "vitest";
import { CONVERSATION_TITLE_SYSTEM_PROMPT } from "@/server/prompts";

describe("prompt markdown loading", () => {
  it("loads the conversation title prompt from markdown", () => {
    expect(CONVERSATION_TITLE_SYSTEM_PROMPT).toContain("Generate a concise title");
    expect(CONVERSATION_TITLE_SYSTEM_PROMPT).toContain("Reply with the title alone");
  });
});
