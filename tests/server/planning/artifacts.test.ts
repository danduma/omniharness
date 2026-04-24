import { describe, expect, it } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

import {
  collectPlannerArtifacts,
  extractPlannerHandoffBlock,
} from "@/server/planning/artifacts";

describe("planner artifact detection", () => {
  it("extracts explicit handoff block paths", () => {
    const handoff = extractPlannerHandoffBlock(`
Done.

<omniharness-plan-handoff>
spec_path: docs/superpowers/specs/2026-04-23-conversation-modes-design.md
plan_path: docs/superpowers/plans/2026-04-23-conversation-modes-implementation.md
ready: yes
summary: Plan is ready.
</omniharness-plan-handoff>
`);

    expect(handoff).toEqual({
      specPath: "docs/superpowers/specs/2026-04-23-conversation-modes-design.md",
      planPath: "docs/superpowers/plans/2026-04-23-conversation-modes-implementation.md",
      ready: true,
      summary: "Plan is ready.",
    });
  });

  it("resolves relative planner artifact paths against cwd", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const specPath = path.join(cwd, "docs/superpowers/specs/test-design.md");
    const planPath = path.join(cwd, "docs/superpowers/plans/test-plan.md");

    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(specPath, "# Spec\n");
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Build it\n");

    const artifacts = await collectPlannerArtifacts({
      cwd,
      outputText: `
<omniharness-plan-handoff>
spec_path: docs/superpowers/specs/test-design.md
plan_path: docs/superpowers/plans/test-plan.md
ready: yes
</omniharness-plan-handoff>
`,
    });

    expect(artifacts.specPath).toBe(specPath);
    expect(artifacts.planPath).toBe(planPath);
    expect(artifacts.candidates.some((candidate) => candidate.kind === "plan" && candidate.exists)).toBe(true);
  });

  it("keeps multiple candidates when output is ambiguous", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const firstPlan = path.join(cwd, "docs/superpowers/plans/first.md");
    const secondPlan = path.join(cwd, "vibes/second.md");

    fs.mkdirSync(path.dirname(firstPlan), { recursive: true });
    fs.mkdirSync(path.dirname(secondPlan), { recursive: true });
    fs.writeFileSync(firstPlan, "## One\n- [ ] First\n");
    fs.writeFileSync(secondPlan, "## Two\n- [ ] Second\n");

    const artifacts = await collectPlannerArtifacts({
      cwd,
      outputText: `I created docs/superpowers/plans/first.md and vibes/second.md`,
    });

    expect(artifacts.candidates.filter((candidate) => candidate.kind === "plan")).toHaveLength(2);
    expect(artifacts.planPath).toBeNull();
  });

  it("reports readiness gaps for invalid plan candidates", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const planPath = path.join(cwd, "docs/superpowers/plans/invalid.md");

    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath, "# not a checklist\n");

    const artifacts = await collectPlannerArtifacts({
      cwd,
      outputText: `Saved docs/superpowers/plans/invalid.md`,
    });

    const invalidPlan = artifacts.candidates.find((candidate) => candidate.path === planPath);
    expect(invalidPlan?.readiness?.ready).toBe(false);
    expect(invalidPlan?.readiness?.gaps).toContain("No checklist items were found in the plan.");
  });
});
