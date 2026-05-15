import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { db } from "@/server/db";
import { messages, plans, runs, workerCounters, workers } from "@/server/db/schema";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import {
  __getRingForTests,
  __resetNamedEventsForTests,
} from "@/server/events/named-events";

vi.mock("@/server/plans/readiness-pipeline", async () => {
  return {
    ensureReadinessVerdict: vi.fn().mockResolvedValue({
      verdict: "ready",
      reason: "test",
      planHash: "h",
    }),
    loadCachedReadinessRecord: vi.fn().mockResolvedValue(null),
    hashPlanMarkdown: (s: string) => `hash:${s.length}`,
  };
});

const PLAN_DIR = path.join(os.tmpdir(), "omni-plan-ready-event-");
const PLAN_ID = "plan-ready-event";
const RUN_ID = "run-ready-event";

async function seedPlanAndRun(runStatus: string) {
  const now = new Date();
  const cwd = fs.mkdtempSync(PLAN_DIR);
  const planPath = path.join(cwd, "docs/superpowers/plans/feature.md");
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, "## Phase 1\n- [ ] Task\n");

  await db.insert(plans).values({
    id: PLAN_ID,
    path: planPath,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: RUN_ID,
    planId: PLAN_ID,
    mode: "planning",
    projectPath: cwd,
    title: "Plan ready test",
    preferredWorkerType: "codex",
    allowedWorkerTypes: "codex",
    status: runStatus,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: "worker-ready",
    runId: RUN_ID,
    type: "codex",
    status: "idle",
    cwd,
    outputLog: planPath,
    outputEntriesJson: "[]",
    currentText: "",
    lastText: planPath,
    createdAt: now,
    updatedAt: now,
  });
  return { cwd, planPath };
}

describe("plan.ready named event", () => {
  beforeEach(async () => {
    __resetNamedEventsForTests();
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("emits plan.ready when run status transitions into ready", async () => {
    await seedPlanAndRun("working");
    const currentRun = (await db.select().from(runs)).find((r) => r.id === RUN_ID)!;

    await refreshPlanningArtifactsForRun({ run: currentRun, status: "ready" });

    const readyEvents = __getRingForTests().filter((entry) => entry.event.kind === "plan.ready");
    expect(readyEvents).toHaveLength(1);
    expect(readyEvents[0]!.event).toMatchObject({
      kind: "plan.ready",
      runId: RUN_ID,
      planId: PLAN_ID,
    });
  });

  it("does not emit plan.ready when the run was already ready", async () => {
    await seedPlanAndRun("ready");
    const currentRun = (await db.select().from(runs)).find((r) => r.id === RUN_ID)!;

    await refreshPlanningArtifactsForRun({ run: currentRun, status: "ready" });

    const readyEvents = __getRingForTests().filter((entry) => entry.event.kind === "plan.ready");
    expect(readyEvents).toHaveLength(0);
  });
});
