import { describe, expect, it } from "vitest";
import { assessPlanReadiness } from "@/server/plans/readiness";

describe("assessPlanReadiness", () => {
  it("flags vague plans as not ready and produces clarification questions", async () => {
    const result = await assessPlanReadiness({
      markdown: `# Plan

## Phase 1
- [ ] Improve onboarding
`,
      items: [
        {
          id: "item-1",
          phase: "Phase 1",
          title: "Improve onboarding",
          sourceLine: 4,
        },
      ],
    });

    expect(result.ready).toBe(false);
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions[0]).toContain("Improve onboarding");
  });
});
