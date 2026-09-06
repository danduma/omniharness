import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, dbClient } from "@/server/db";
import { plans, runGoalOperations, runGoalOutbox, runGoals, runs, workers } from "@/server/db/schema";
import { goalControl } from "@/server/runs/goal-control";
import {
  extractPlanReferencesFromObjective,
  refreshDerivedGoalPlan,
} from "@/server/runs/goal-plan-derivation";

const bridgeMocks = vi.hoisted(() => ({
  getAgent: vi.fn(),
  invokeAgentAcpMethod: vi.fn(),
  askAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => bridgeMocks);

const RUN_ID = "goal-derive-run";
const GOAL_ID = "goal-derive-1";

const PLAN_MARKDOWN = `# Caption Font Sizing Contract Implementation Plan

**Goal:** Keep both sizing behaviors as explicit preset choices.

## Task 1: Defaults table

- [x] Write the failing test.
  - Verify: the test fails for the stated reason.
- [ ] Create the defaults module.
  - Verify: \`node --test\` passes.

## Task 2: Terminal preset

- [ ] Move the terminal preset to the plain engine.
  - Verify: the preset renders at 130 px.
`;

let projectPath: string;
let planPath: string;

async function seedGoal(objective: string) {
  const result = await goalControl.putGoal({
    runId: RUN_ID,
    goalId: GOAL_ID,
    expectedRevision: 0,
    operationId: `op-${Math.random()}`,
    principalId: "test",
    endpoint: "goal.put",
    objective,
  });
  if (!result.ok) throw new Error(result.message);
  return result.snapshot;
}

describe("derived goal plans", () => {
  beforeEach(async () => {
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omni-goal-plan-"));
    fs.mkdirSync(path.join(projectPath, "docs", "plans"), { recursive: true });
    planPath = path.join(projectPath, "docs", "plans", "2026-09-05-caption-font-sizing-contract.md");
    fs.writeFileSync(planPath, PLAN_MARKDOWN, "utf8");

    await db.delete(runGoalOutbox);
    await db.delete(runGoalOperations);
    await db.delete(runGoals);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    const now = Date.now();
    await dbClient.batch([
      {
        sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        args: ["goal-derive-plan", "vibes/ad-hoc/scratch.md", "running", now, now],
      },
      {
        sql: "INSERT INTO runs (id, plan_id, status, project_path, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [RUN_ID, "goal-derive-plan", "running", projectPath, "direct", now, now],
      },
      {
        sql: "INSERT INTO workers (id, run_id, type, status, cwd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: ["goal-derive-worker", RUN_ID, "codex", "idle", projectPath, now, now],
      },
    ], "write");
  });

  afterEach(() => {
    fs.rmSync(projectPath, { recursive: true, force: true });
  });

  it("finds markdown references in an objective", () => {
    expect(extractPlanReferencesFromObjective(
      "Fully implement /repo/docs/superpowers/plans/2026-09-05-thing.md",
    )).toEqual(["/repo/docs/superpowers/plans/2026-09-05-thing.md"]);
    expect(extractPlanReferencesFromObjective("Implement `docs/plans/a.md`, then ship."))
      .toEqual(["docs/plans/a.md"]);
    expect(extractPlanReferencesFromObjective("Refactor the caption pipeline")).toEqual([]);
  });

  it("fills an empty goal plan from the plan file the objective names", async () => {
    await seedGoal(`Fully implement ${planPath}`);

    const result = await refreshDerivedGoalPlan(RUN_ID, "goal_created");

    expect(result).toMatchObject({ kind: "derived", itemCount: 3 });
    const goal = await goalControl.getGoal(RUN_ID);
    expect(goal?.planSource).toEqual({ kind: "uri", uri: pathToFileURL(planPath).toString() });
    expect(goal?.plan.map((item) => [item.phase, item.title, item.status])).toEqual([
      ["Task 1: Defaults table", "Write the failing test.", "completed"],
      ["Task 1: Defaults table", "Create the defaults module.", "pending"],
      ["Task 2: Terminal preset", "Move the terminal preset to the plain engine.", "pending"],
    ]);
  });

  it("resolves a project-relative reference", async () => {
    await seedGoal("Implement docs/plans/2026-09-05-caption-font-sizing-contract.md");

    expect(await refreshDerivedGoalPlan(RUN_ID, "goal_created")).toMatchObject({ kind: "derived" });
  });

  it("refuses to read a plan outside the project", async () => {
    const outside = path.join(os.tmpdir(), "omni-outside-plan.md");
    fs.writeFileSync(outside, PLAN_MARKDOWN, "utf8");
    try {
      await seedGoal(`Implement ${outside}`);
      expect(await refreshDerivedGoalPlan(RUN_ID, "goal_created"))
        .toEqual({ kind: "skipped", reason: "reference_outside_project" });
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it("skips objectives that name no plan file", async () => {
    await seedGoal("Refactor the caption pipeline");

    expect(await refreshDerivedGoalPlan(RUN_ID, "goal_created"))
      .toEqual({ kind: "skipped", reason: "no_plan_reference" });
  });

  it("re-derives ticked checkboxes and leaves an unchanged file alone", async () => {
    await seedGoal(`Fully implement ${planPath}`);
    const first = await refreshDerivedGoalPlan(RUN_ID, "goal_created");
    expect(first).toMatchObject({ kind: "derived" });

    expect(await refreshDerivedGoalPlan(RUN_ID, "turn_settled"))
      .toEqual({ kind: "skipped", reason: "unchanged" });

    const idsBefore = (await goalControl.getGoal(RUN_ID))?.plan.map((item) => item.id);
    fs.writeFileSync(planPath, PLAN_MARKDOWN.replace("- [ ] Create the defaults module.", "- [x] Create the defaults module."), "utf8");
    expect(await refreshDerivedGoalPlan(RUN_ID, "turn_settled")).toMatchObject({ kind: "derived" });

    const goal = await goalControl.getGoal(RUN_ID);
    expect(goal?.plan.filter((item) => item.status === "completed")).toHaveLength(2);
    // Ticking a box must not renumber the rows the UI already rendered.
    expect(goal?.plan.map((item) => item.id)).toEqual(idsBefore);
  });

  it("never overwrites a plan the provider owns", async () => {
    const snapshot = await seedGoal(`Fully implement ${planPath}`);
    const attached = await goalControl.attachLease({
      runId: RUN_ID,
      goalId: GOAL_ID,
      expectedRevision: snapshot.revision,
      workerId: "goal-derive-worker",
      acpSessionId: "session-1",
    });
    if (!attached.ok) throw new Error(attached.message);
    const provider = await goalControl.applyProviderUpdate({
      runId: RUN_ID,
      goalId: GOAL_ID,
      expectedRevision: attached.snapshot.revision,
      workerId: "goal-derive-worker",
      acpSessionId: "session-1",
      leaseGeneration: attached.snapshot.leaseGeneration,
      plan: [{ id: "p-1", title: "Provider step", phase: null, status: "in_progress", order: 0, providerId: "p-1" }],
      planSource: { kind: "items" },
    });
    if (!provider.ok) throw new Error(provider.message);

    expect(await refreshDerivedGoalPlan(RUN_ID, "turn_settled"))
      .toEqual({ kind: "skipped", reason: "provider_owns_plan" });
    expect((await goalControl.getGoal(RUN_ID))?.plan).toHaveLength(1);
  });
});
