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

  it("accepts short action titles when nested details define deliverable and verification", async () => {
    const result = await assessPlanReadiness({
      markdown: `# Plan

## Phase 1
- [ ] Update package.json scripts.
  - Add \`admin:parity:old\`, \`admin:parity:new\`, \`admin:parity:capture\`, \`admin:parity:compare\`, \`admin:parity:report\`.
  - Verify: each script runs or prints a clear missing-prerequisite message.
`,
      items: [
        {
          id: "item-1",
          phase: "Phase 1",
          title: "Update package.json scripts.",
          sourceLine: 4,
          details:
            "- Add `admin:parity:old`, `admin:parity:new`, `admin:parity:capture`, `admin:parity:compare`, `admin:parity:report`.\n- Verify: each script runs or prints a clear missing-prerequisite message.",
        },
      ],
    });

    expect(result.ready).toBe(true);
    expect(result.questions).toEqual([]);
  });

  it("does not require formal validation for concrete single-file config edits", async () => {
    const result = await assessPlanReadiness({
      markdown: `# Plan

## Phase 1
- [ ] Update package.json scripts.
  - Add \`admin:parity:old\`, \`admin:parity:new\`, and \`admin:parity:compare\`.
`,
      items: [
        {
          id: "item-1",
          phase: "Phase 1",
          title: "Update package.json scripts.",
          sourceLine: 4,
          details: "- Add `admin:parity:old`, `admin:parity:new`, and `admin:parity:compare`.",
        },
      ],
    });

    expect(result.ready).toBe(true);
    expect(result.questions).toEqual([]);
  });
});
