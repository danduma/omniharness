import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { messages, planningReviewRuns, plans, runs, workerCounters, workers } from "@/server/db/schema";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";

describe("refreshPlanningArtifactsForRun", () => {
  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(planningReviewRuns);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("does not derive planning artifacts from user prompts or tool output entries", async () => {
    const now = new Date();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-refresh-"));
    const oldPlan = path.join(cwd, "docs/superpowers/plans/old-plan.md");

    fs.mkdirSync(path.dirname(oldPlan), { recursive: true });
    fs.writeFileSync(oldPlan, "## Phase 1\n- [ ] Keep old behavior\n");

    await db.insert(plans).values({
      id: "plan-refresh",
      path: oldPlan,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-refresh",
      planId: "plan-refresh",
      mode: "planning",
      projectPath: cwd,
      title: "Planning refresh",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "high",
      allowedWorkerTypes: "codex",
      status: "working",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: "worker-refresh",
      runId: "run-refresh",
      type: "codex",
      status: "working",
      cwd,
      outputLog: "",
      outputEntriesJson: JSON.stringify([
        {
          id: "tool-entry",
          type: "tool_call_update",
          text: `docs/superpowers/plans/old-plan.md`,
          timestamp: now.toISOString(),
        },
      ]),
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: "message-refresh",
      runId: "run-refresh",
      role: "user",
      kind: "planning",
      content: "Please inspect docs/superpowers/plans/old-plan.md before planning.",
      createdAt: now,
    });

    const run = await db.select().from(runs).where(eq(runs.id, "run-refresh")).get();
    const worker = await db.select().from(workers).where(eq(workers.id, "worker-refresh")).get();

    expect(run).toBeTruthy();
    expect(worker).toBeTruthy();

    const result = await refreshPlanningArtifactsForRun({
      run: run!,
      worker,
      snapshot: {
        name: "worker-refresh",
        type: "codex",
        cwd,
        state: "working",
        lastText: "",
        currentText: "",
        renderedOutput: `docs/superpowers/plans/old-plan.md`,
        outputEntries: [
          {
            id: "live-tool-entry",
            type: "tool_call_update",
            text: `docs/superpowers/plans/old-plan.md`,
            timestamp: now.toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: null,
      },
      status: "working",
    });

    expect(result.artifacts).toEqual({
      specPath: null,
      planPath: null,
      candidates: [],
    });
  });

  it("recovers a stale busy failure when the planner has produced a ready handoff", async () => {
    const now = new Date();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-ready-"));
    const specPath = path.join(cwd, "docs/superpowers/specs/ready-spec.md");
    const planPath = path.join(cwd, "docs/superpowers/plans/ready-plan.md");

    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(specPath, "# Ready Spec\n");
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Implement the thing\n  - Verify: feature is live\n");

    await db.insert(plans).values({
      id: "plan-ready",
      path: planPath,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-ready",
      planId: "plan-ready",
      mode: "planning",
      projectPath: cwd,
      title: "Ready planning run",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "high",
      allowedWorkerTypes: "codex",
      status: "failed",
      failedAt: now,
      lastError: "Ask failed: Agent is busy: worker-ready",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: "worker-ready",
      runId: "run-ready",
      type: "codex",
      status: "error",
      cwd,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still planning.",
      lastText: "Still planning.",
      createdAt: now,
      updatedAt: now,
    });

    const run = await db.select().from(runs).where(eq(runs.id, "run-ready")).get();
    const worker = await db.select().from(workers).where(eq(workers.id, "worker-ready")).get();

    expect(run).toBeTruthy();
    expect(worker).toBeTruthy();

    const handoff = `<omniharness-plan-handoff>
spec_path: docs/superpowers/specs/ready-spec.md
plan_path: docs/superpowers/plans/ready-plan.md
ready: yes
summary: Plan is ready.
</omniharness-plan-handoff>`;

    const result = await refreshPlanningArtifactsForRun({
      run: run!,
      worker,
      snapshot: {
        name: "worker-ready",
        type: "codex",
        cwd,
        state: "idle",
        lastError: null,
        lastText: handoff,
        currentText: "",
        renderedOutput: handoff,
        outputEntries: [
          {
            id: "ready-entry",
            type: "message",
            text: handoff,
            timestamp: now.toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: "end_turn",
      },
    });

    const refreshedRun = await db.select().from(runs).where(eq(runs.id, "run-ready")).get();

    expect(result.status).toBe("ready");
    expect(refreshedRun?.status).toBe("ready");
    expect(refreshedRun?.lastError).toBeNull();
    expect(refreshedRun?.failedAt).toBeNull();
    expect(refreshedRun?.artifactPlanPath).toBe(planPath);
    expect(refreshedRun?.specPath).toBe(specPath);
  });

  it("clears revising_plan status once no review run is still running", async () => {
    const now = new Date();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-planning-revising-"));
    const specPath = path.join(cwd, "docs/superpowers/specs/spec.md");
    const planPath = path.join(cwd, "docs/superpowers/plans/plan.md");
    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(specPath, "# Spec\n");
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Do the thing\n  - Verify: it works\n");

    await db.insert(plans).values({
      id: "plan-revising",
      path: planPath,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-revising",
      planId: "plan-revising",
      mode: "planning",
      projectPath: cwd,
      title: "Revising run",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "high",
      allowedWorkerTypes: "codex",
      status: "revising_plan",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: "worker-revising",
      runId: "run-revising",
      type: "codex",
      status: "idle",
      cwd,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    const handoff = `<omniharness-plan-handoff>
spec_path: ${specPath}
plan_path: ${planPath}
ready: yes
summary: Done.
</omniharness-plan-handoff>`;

    await db.insert(planningReviewRuns).values({
      id: "review-active",
      runId: "run-revising",
      status: "running",
      agentSelection: "auto",
      roundsRequested: 1,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const stillStuckRun = await db.select().from(runs).where(eq(runs.id, "run-revising")).get();
    const stillStuck = await refreshPlanningArtifactsForRun({
      run: stillStuckRun!,
      worker: await db.select().from(workers).where(eq(workers.id, "worker-revising")).get(),
      snapshot: {
        name: "worker-revising",
        type: "codex",
        cwd,
        state: "idle",
        lastText: handoff,
        currentText: "",
        renderedOutput: handoff,
        outputEntries: [
          { id: "h", type: "message", text: handoff, timestamp: now.toISOString() },
        ],
        stderrBuffer: [],
        stopReason: "end_turn",
      },
    });
    expect(stillStuck.status).toBe("revising_plan");

    await db.update(planningReviewRuns)
      .set({ status: "completed", completedAt: now, updatedAt: now })
      .where(eq(planningReviewRuns.id, "review-active"));

    const releasedRun = await db.select().from(runs).where(eq(runs.id, "run-revising")).get();
    const released = await refreshPlanningArtifactsForRun({
      run: releasedRun!,
      worker: await db.select().from(workers).where(eq(workers.id, "worker-revising")).get(),
      snapshot: {
        name: "worker-revising",
        type: "codex",
        cwd,
        state: "idle",
        lastText: handoff,
        currentText: "",
        renderedOutput: handoff,
        outputEntries: [
          { id: "h", type: "message", text: handoff, timestamp: now.toISOString() },
        ],
        stderrBuffer: [],
        stopReason: "end_turn",
      },
    });
    expect(released.status).toBe("ready");

    const finalRun = await db.select().from(runs).where(eq(runs.id, "run-revising")).get();
    expect(finalRun?.status).toBe("ready");
  });
});
