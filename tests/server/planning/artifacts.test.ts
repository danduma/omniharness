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

  it("does not mix unrelated transcript paths into an explicit handoff", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const specPath = path.join(cwd, "docs/superpowers/specs/current-design.md");
    const planPath = path.join(cwd, "docs/superpowers/plans/current-plan.md");
    const unrelatedPlanPath = path.join(cwd, "docs/superpowers/plans/old-plan.md");

    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(specPath, "# Spec\n");
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Build current workflow\n");
    fs.writeFileSync(unrelatedPlanPath, "## Phase 1\n- [ ] Build old workflow\n");

    const artifacts = await collectPlannerArtifacts({
      cwd,
      outputText: `
Earlier repo search found docs/superpowers/plans/old-plan.md.

<omniharness-plan-handoff>
spec_path: docs/superpowers/specs/current-design.md
plan_path: docs/superpowers/plans/current-plan.md
ready: yes
</omniharness-plan-handoff>
`,
    });

    expect(artifacts.specPath).toBe(specPath);
    expect(artifacts.planPath).toBe(planPath);
    expect(artifacts.candidates.map((candidate) => candidate.path)).toEqual([specPath, planPath]);
    expect(artifacts.candidates.every((candidate) => candidate.source === "handoff")).toBe(true);
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

  it("detects artifact paths listed immediately after an intentional artifact reference", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const planPath = path.join(cwd, "docs/superpowers/plans/current-plan.md");

    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Build current workflow\n");

    const artifacts = await collectPlannerArtifacts({
      cwd,
      outputText: `
I created these planning artifacts:
- docs/superpowers/plans/current-plan.md
`,
    });

    expect(artifacts.planPath).toBe(planPath);
  });

  it("infers a sibling design spec when only the plan artifact was mentioned", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const specPath = path.join(cwd, "docs/superpowers/specs/intermediate-scene-assets-design.md");
    const planPath = path.join(cwd, "docs/superpowers/plans/intermediate-scene-assets.md");

    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(specPath, "# Intermediate Scene Assets Design\n");
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Build scene search\n");

    const artifacts = await collectPlannerArtifacts({
      cwd,
      outputText: `I wrote docs/superpowers/plans/intermediate-scene-assets.md`,
    });

    expect(artifacts.planPath).toBe(planPath);
    expect(artifacts.specPath).toBe(specPath);
    expect(artifacts.candidates.some((candidate) => candidate.kind === "spec" && candidate.path === specPath)).toBe(true);
  });

  it("ignores incidental markdown paths that were not presented as planner artifacts", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const oldPlan = path.join(cwd, "docs/superpowers/plans/old-plan.md");

    fs.mkdirSync(path.dirname(oldPlan), { recursive: true });
    fs.writeFileSync(oldPlan, "## Phase 1\n- [ ] Keep old behavior\n");

    const artifacts = await collectPlannerArtifacts({
      cwd,
      outputText: `
Search results:
docs/superpowers/plans/old-plan.md
docs/superpowers/specs/old-design.md
`,
    });

    expect(artifacts.candidates).toEqual([]);
    expect(artifacts.planPath).toBeNull();
    expect(artifacts.specPath).toBeNull();
  });

  it("relocates handoff artifacts from the agent scratch dir into the project", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-"));
    const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-scratch-"));
    const scratchPlansDir = path.join(scratchRoot, "omniharness", "abc-123", "plans");
    fs.mkdirSync(scratchPlansDir, { recursive: true });
    const scratchPlanPath = path.join(scratchPlansDir, "cli-quota-tracking-plan.md");
    fs.writeFileSync(scratchPlanPath, "## Phase 1\n- [ ] Track CLI quota\n");

    const previousOverride = process.env.OMNIHARNESS_AGENT_SCRATCH_ROOTS;
    process.env.OMNIHARNESS_AGENT_SCRATCH_ROOTS = scratchRoot;
    try {
      const artifacts = await collectPlannerArtifacts({
        cwd,
        outputText: `
Plan approved: ${scratchPlanPath}

<omniharness-plan-handoff>
plan_path: docs/superpowers/plans/cli-quota-tracking.md
ready: yes
</omniharness-plan-handoff>
`,
      });

      const expectedTarget = path.join(cwd, "docs/superpowers/plans/cli-quota-tracking-plan.md");
      expect(fs.existsSync(expectedTarget)).toBe(true);
      expect(artifacts.planPath).toBe(expectedTarget);
      const relocatedCandidate = artifacts.candidates.find((candidate) => candidate.path === expectedTarget);
      expect(relocatedCandidate?.exists).toBe(true);
      expect(relocatedCandidate?.evidence).toContain("relocated from agent scratch dir");
    } finally {
      if (previousOverride === undefined) {
        delete process.env.OMNIHARNESS_AGENT_SCRATCH_ROOTS;
      } else {
        process.env.OMNIHARNESS_AGENT_SCRATCH_ROOTS = previousOverride;
      }
    }
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
