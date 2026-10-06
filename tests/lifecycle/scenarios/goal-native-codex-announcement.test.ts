import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { artifactStreams, executionEvents, recoveryIncidents, runGoalOperations, runGoalOutbox, runGoals, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { handleAcpGoalSessionUpdateForWorker } from "@/server/agent-runtime/acp/goal-state";
import { eventsRouteModule, goalRouteModule } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(runGoalOutbox);
  await db.delete(runGoalOperations);
  await db.delete(runGoals);
  await db.delete(executionEvents);
  await db.delete(artifactStreams);
  await db.delete(recoveryIncidents);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRouteModule },
      { pattern: "/api/runs/:id/goal", module: goalRouteModule },
      { pattern: "/api/runs/:id/goal/actions", module: goalRouteModule },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  await db.delete(runGoalOutbox);
  await db.delete(runGoalOperations);
  await db.delete(runGoals);
  await db.delete(executionEvents);
  await db.delete(artifactStreams);
  await db.delete(recoveryIncidents);
  await clearLifecycleSchema();
});

// Mirrors session 9d1e7dd343df: Codex reported active without capabilities
// on the status frame; controls were advertised on InitializeResponse._meta.
describe("lifecycle — native Codex goal announcement", () => {
  it("publishes a visible active goal with native controls and restores it on reconnect", async () => {
    const { runId } = await seedDirectRun();
    const now = new Date();
    const workerId = `${runId}-worker-1`;
    await db.insert(workers).values({
      id: workerId, runId, type: "codex", status: "working", cwd: "/tmp",
      createdAt: now, updatedAt: now,
    });
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    const result = await handleAcpGoalSessionUpdateForWorker({
      workerId, sessionId: "native-session",
      agentCapabilities: { _meta: { goal: {
        version: 1, controlMethod: "_session/goal", actions: ["set", "pause", "resume", "clear"],
      } } },
      update: { sessionUpdate: "session_info_update", _meta: { goal: {
        objective: "Fully implement the editor plan", status: "active",
        tokenBudget: null, tokensUsed: 0, timeUsedSeconds: 0,
        createdAt: 1790789254000, updatedAt: 1790789254000, controlMethod: "_session/goal",
      } } },
    });
    expect(result).toMatchObject({ kind: "accepted" });
    await client.waitFor("goal.updated", { timeoutMs: 10_000 });
    const expectedGoal = {
      visible: true, objective: "Fully implement the editor plan", status: "pursuing",
      capabilities: { set: true, edit: true, pause: true, resume: true, clear: true },
    };
    const loaded = await client.getJson(`/api/runs/${runId}/goal`);
    expect(loaded.body).toMatchObject({ goal: expectedGoal });
    client.dropSse();
    const bootstrap = await client.bootstrapSnapshot(runId);
    expect(bootstrap.snapshot).toMatchObject({ goalsByRunId: { [runId]: expectedGoal } });
  });
});
