import { describe, expect, it } from "vitest";
import {
  CONVERSATION_TITLE_SYSTEM_PROMPT,
  PLANNER_SYSTEM_PROMPT,
  SUPERVISOR_SYSTEM_PROMPT,
} from "@/server/prompts";

describe("prompt markdown loading", () => {
  it("loads the supervisor prompt from markdown", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("You are the OmniHarness Supervisor.");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("You must answer with exactly one tool call every turn.");
  });

  it("loads the conversation title prompt from markdown", () => {
    expect(CONVERSATION_TITLE_SYSTEM_PROMPT).toContain("Generate a concise title for a coding conversation.");
    expect(CONVERSATION_TITLE_SYSTEM_PROMPT).toContain("never use ISO timestamps or markdown filenames");
  });

  it("loads the planner prompt from markdown", () => {
    expect(PLANNER_SYSTEM_PROMPT).toContain("<omniharness-plan-handoff>");
    expect(PLANNER_SYSTEM_PROMPT).toContain("Do not start implementation");
    expect(PLANNER_SYSTEM_PROMPT).toContain("relative to the current cwd");
    expect(PLANNER_SYSTEM_PROMPT).toContain("high-level objective");
    expect(PLANNER_SYSTEM_PROMPT).toContain("as many clarification turns as needed");
  });
});
