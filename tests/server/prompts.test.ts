import { describe, expect, it } from "vitest";
import {
  CONVERSATION_TITLE_SYSTEM_PROMPT,
  PLANNER_SYSTEM_PROMPT,
  SUPERVISOR_SYSTEM_PROMPT,
  buildPlannerSystemPrompt,
} from "@/server/prompts";

describe("prompt markdown loading", () => {
  it("loads the supervisor prompt from markdown", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("You are the OmniHarness Supervisor.");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("You must answer with exactly one tool call for each model request.");
  });

  it("loads the conversation title prompt from markdown", () => {
    expect(CONVERSATION_TITLE_SYSTEM_PROMPT).toContain("Generate a concise title for a coding conversation.");
    expect(CONVERSATION_TITLE_SYSTEM_PROMPT).toContain("never use ISO timestamps or markdown filenames");
  });

  it("loads the planner prompt from markdown", () => {
    expect(PLANNER_SYSTEM_PROMPT).toContain("<omniharness-plan-handoff>");
    expect(PLANNER_SYSTEM_PROMPT).toContain("Do not start implementation");
    expect(PLANNER_SYSTEM_PROMPT).toContain("absolute paths under that project root");
    expect(PLANNER_SYSTEM_PROMPT).toContain("{{project_root}}");
  });

  it("substitutes the project root into the planner prompt", () => {
    const rendered = buildPlannerSystemPrompt("/tmp/example-project");
    expect(rendered).toContain("/tmp/example-project/docs/superpowers/plans/");
    expect(rendered).not.toContain("{{project_root}}");
    expect(PLANNER_SYSTEM_PROMPT).toContain("high-level objective");
    expect(PLANNER_SYSTEM_PROMPT).toContain("before writing final artifacts whenever the request is underspecified");
    expect(PLANNER_SYSTEM_PROMPT).toContain("Skip questions only when the request is already concrete enough");
  });
});
