import { describe, expect, it } from "vitest";
import { assessPlanReadiness } from "@/server/plans/readiness";
import { parsePlan } from "@/server/plans/parser";

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

  it("accepts file-scoped implementation tasks when nested bullets define the behavior", async () => {
    const result = await assessPlanReadiness({
      markdown: `# Plan

## Implementation Tasks
- [ ] Update src/components/home/HomeHeader.tsx.
  - Rename title/aria copy from \`Toggle Conversation Workers\` to \`Toggle side window\`.
  - Keep the \`PanelRight\` icon.
  - Render the mobile sheet with \`SideWindow\` instead of \`WorkersSidebar\`.
`,
      items: [
        {
          id: "item-1",
          phase: "Implementation Tasks",
          title: "Update src/components/home/HomeHeader.tsx.",
          sourceLine: 4,
          details:
            "- Rename title/aria copy from `Toggle Conversation Workers` to `Toggle side window`.\n- Keep the `PanelRight` icon.\n- Render the mobile sheet with `SideWindow` instead of `WorkersSidebar`.",
        },
      ],
    });

    expect(result.ready).toBe(true);
    expect(result.questions).toEqual([]);
  });

  it("accepts the side-window file-tabs plan without generating per-file clarification questions", async () => {
    const plan = parsePlan(`# Side Window File Tabs Implementation Plan

**Goal:** Let users open project files in the existing right side window as closeable tabs next to a pinned, non-closeable \`Conversation Workers\` tab.

## Implementation Tasks

- [ ] Update \`src/components/home/HomeHeader.tsx\`.
  - Rename title/aria copy from \`Toggle Conversation Workers\` to \`Toggle side window\` or \`Toggle workspace side window\`.
  - Keep the \`PanelRight\` icon.
  - Render the mobile sheet with \`SideWindow\` instead of \`WorkersSidebar\`.
  - Ensure the sheet remains usable even for non-implementation conversations with a project scope.

- [ ] Update \`src/components/home/ConversationComposer.tsx\`.
  - Add prop \`onOpenProjectFile?: (filePath: string) => void\`.
  - In the mention picker, keep row click as \`applyMention(filePath)\`.
  - Add a right-aligned icon button with \`aria-label={\`Open \${filePath} in side window\`}\` that calls \`onOpenProjectFile(filePath)\` on mouse down/click without moving textarea focus unexpectedly.
  - Prevent event propagation so the open action does not also insert the mention.

## Acceptance Criteria

- Opening a file creates or focuses a file tab next to the workers tab.
- Desktop resizing and mobile sheet behavior continue to work.
`);

    const result = await assessPlanReadiness(plan);

    expect(result.ready).toBe(true);
    expect(result.questions).not.toContain('What concrete deliverable should satisfy "Update `src/components/home/HomeHeader.tsx`."?');
    expect(result.questions).not.toContain('How will we verify that "Update `src/components/home/ConversationComposer.tsx`." is complete?');
  });
});
