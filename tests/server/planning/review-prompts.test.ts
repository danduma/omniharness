import { describe, expect, it } from "vitest";
import { buildReviewerPrompt, buildPlannerRevisionPrompt } from "@/server/planning/review-prompts";

describe("planning review prompts", () => {
  it("builds a reviewer prompt with required constraints", () => {
    const prompt = buildReviewerPrompt({
      userIntent: "Build a todo app",
      specPath: "spec.md",
      specContent: "Spec content",
      planPath: "plan.md",
      planContent: "Plan content",
    });

    expect(prompt).toContain("READ-ONLY planning reviewer");
    expect(prompt).toContain("DO NOT edit any files");
    expect(prompt).toContain("JSON format");
    expect(prompt).toContain("Build a todo app");
    expect(prompt).toContain("spec.md");
    expect(prompt).toContain("plan.md");
  });

  it("builds a planner revision prompt with findings", () => {
    const prompt = buildPlannerRevisionPrompt({
      roundNumber: 1,
      findings: [
        {
          severity: "major",
          category: "testing",
          title: "Missing tests",
          details: "No tests defined",
          recommendation: "Add vitest tests",
        }
      ],
    });

    expect(prompt).toContain("Reviewer findings (Round 1)");
    expect(prompt).toContain("[MAJOR] Missing tests");
    expect(prompt).toContain("revise the specification and implementation plan");
    expect(prompt).toContain("READY planning handoff block");
  });
});
