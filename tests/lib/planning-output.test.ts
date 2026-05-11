import { describe, expect, it } from "vitest";
import { isPlannerHandoffText, shouldShowPlanningTerminalActivity } from "@/lib/planning-output";

describe("planning output", () => {
  it("detects planner handoff messages", () => {
    expect(isPlannerHandoffText("<omniharness-plan-handoff>ready</omniharness-plan-handoff>")).toBe(true);
    expect(isPlannerHandoffText("The plan is in docs/superpowers/plans/example.md")).toBe(false);
  });

  it("filters handoff messages without hiding thoughts or tools", () => {
    expect(shouldShowPlanningTerminalActivity({
      kind: "message",
      text: "<omniharness-plan-handoff>ready</omniharness-plan-handoff>",
    })).toBe(false);
    expect(shouldShowPlanningTerminalActivity({ kind: "message", text: "Here is the reasoning." })).toBe(true);
    expect(shouldShowPlanningTerminalActivity({ kind: "thinking", text: "Explore the repo." })).toBe(true);
    expect(shouldShowPlanningTerminalActivity({ kind: "tool", text: "Read file." })).toBe(true);
  });
});
