import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactStreams, executionEvents, recoveryIncidents, runGoalOperations, runGoalOutbox, runGoals, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { handleAcpGoalSessionUpdateForWorker } from "@/server/agent-runtime/acp/goal-state";
import { eventsRouteModule, goalRouteModule } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";

/**
 * Reported bug: a `/goal fully implement <plan>.md` conversation ran to
 * completion and the goal card still read "No plan items yet", because Codex
 * announces its goal over ACP without ever sending a plan update.
 */

let server: LifecycleServer;
let client: LifecycleClient;
let projectPath: string;
let planPath: string;

const PLAN_MARKDOWN = `# Caption Font Sizing Contract Implementation Plan

## Task 1: Defaults table

- [ ] Write the failing test.
  - Verify: the test fails for the stated reason.
- [ ] Create the defaults module.
  - Verify: \`node --test\` passes.
`;

async function reset() {
  await db.delete(runGoalOutbox);
  await db.delete(runGoalOperations);
  await db.delete(runGoals);
  await db.delete(executionEvents);
  await db.delete(artifactStreams);
  await db.delete(recoveryIncidents);
  await clearLifecycleSchema();
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omni-lifecycle-plan-"));
  fs.mkdirSync(path.join(projectPath, "docs", "plans"), { recursive: true });
  planPath = path.join(projectPath, "docs", "plans", "2026-09-05-caption-font-sizing-contract.md");
  fs.writeFileSync(planPath, PLAN_MARKDOWN, "utf8");
  await reset();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRouteModule },
      { pattern: "/api/runs/:id/goal", module: goalRouteModule },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  await reset();
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("lifecycle — goal plan derived from the plan file the objective names", () => {
  it("fills the goal snapshot from the plan file when the agent announces a goal without a plan", async () => {
    const { runId } = await seedDirectRun();
    const now = new Date();
    await db.update(runs).set({ projectPath, updatedAt: now }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: "derived-plan-worker",
      runId,
      type: "codex",
      status: "working",
      cwd: projectPath,
      createdAt: now,
      updatedAt: now,
    });
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    // Exactly what Codex sends: goal metadata, no plan entries, ever.
    const announced = await handleAcpGoalSessionUpdateForWorker({
      workerId: "derived-plan-worker",
      sessionId: "session-1",
      update: {
        sessionUpdate: "agent_message_chunk",
        _meta: {
          goal: {
            version: 1,
            goalId: "provider",
            objective: `Fully implement ${planPath}`,
            capabilities: { set: true },
          },
        },
      },
    });
    expect(announced).toMatchObject({ kind: "accepted" });

    await client.waitFor("goal.plan.updated", { timeoutMs: 10_000 });
    const loaded = await client.getJson<{
      goal: { plan: Array<{ title: string; status: string }>; planSource: { kind: string; uri?: string } };
    }>(`/api/runs/${runId}/goal`);
    expect(loaded.body.goal.planSource).toMatchObject({ kind: "uri" });
    expect(loaded.body.goal.plan.map((item) => item.title)).toEqual([
      "Write the failing test.",
      "Create the defaults module.",
    ]);
    expect(loaded.body.goal.plan.every((item) => item.status === "pending")).toBe(true);

    const bootstrap = await client.bootstrapSnapshot(runId);
    expect(bootstrap.snapshot).toMatchObject({
      goalsByRunId: { [runId]: { planSource: { kind: "uri" } } },
    });
  });
});
