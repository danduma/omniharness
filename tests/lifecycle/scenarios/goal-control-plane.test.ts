import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { artifactStreams, executionEvents, recoveryIncidents, runGoalOperations, runGoalOutbox, runGoals, runs, workers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { handleAcpGoalSessionUpdateForWorker } from "@/server/agent-runtime/acp/goal-state";
import { goalControl } from "@/server/runs/goal-control";
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

function mutate(path: string, method: "PUT" | "POST", body: unknown) {
  return client.fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("lifecycle — durable goal control plane", () => {
  it("sets, publishes, bootstraps, and rejects a stale edit through HTTP/SSE", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const created = await mutate(`/api/runs/${runId}/goal`, "PUT", {
      goalId: "goal-1",
      expectedRevision: 0,
      operationId: "op-set",
      objective: "Survive reconnects",
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({ goal: { revision: 1, objective: "Survive reconnects" } });
    const published = await client.waitFor("goal.set.completed", { timeoutMs: 10_000 });
    expect(published.payload).toMatchObject({ runId, goalId: "goal-1", revision: 1 });

    const bootstrap = await client.bootstrapSnapshot(runId);
    expect(bootstrap.snapshot).toMatchObject({
      goalsByRunId: { [runId]: { revision: 1, objective: "Survive reconnects" } },
    });

    const stale = await mutate(`/api/runs/${runId}/goal`, "PUT", {
      goalId: "goal-1",
      expectedRevision: 0,
      operationId: "op-stale",
      objective: "Stale overwrite",
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: "goal.revision_conflict" }, goal: { revision: 1 } });
    await client.waitFor("goal.set.refused", { timeoutMs: 10_000 });
  });

  it("replays a clear tombstone after a dropped SSE connection", async () => {
    const { runId } = await seedDirectRun();
    await mutate(`/api/runs/${runId}/goal`, "PUT", {
      goalId: "goal-1", expectedRevision: 0, operationId: "op-set", objective: "Clear safely",
    });
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    client.dropSse();

    const cleared = await mutate(`/api/runs/${runId}/goal/actions`, "POST", {
      goalId: "goal-1", expectedRevision: 1, operationId: "op-clear", action: "clear",
    });
    expect(cleared.status).toBe(200);
    await client.subscribe({ runId });
    const replayed = await client.waitFor("goal.cleared", { timeoutMs: 10_000 });
    expect(replayed.payload).toMatchObject({ runId, revision: 2, snapshot: { visible: false, status: "cleared" } });

    const bootstrap = await client.bootstrapSnapshot(runId);
    expect(bootstrap.snapshot).toMatchObject({
      goalsByRunId: { [runId]: { revision: 2, visible: false, status: "cleared" } },
    });
  });

  it("surfaces an unsupported action without mutating the goal", async () => {
    const { runId } = await seedDirectRun();
    await mutate(`/api/runs/${runId}/goal`, "PUT", {
      goalId: "goal-1", expectedRevision: 0, operationId: "op-set", objective: "Respect capabilities",
    });
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const paused = await mutate(`/api/runs/${runId}/goal/actions`, "POST", {
      goalId: "goal-1", expectedRevision: 1, operationId: "op-pause", action: "pause",
    });
    expect(paused.status).toBe(422);
    expect(await paused.json()).toMatchObject({ error: { code: "goal.action.unsupported" }, goal: { revision: 1 } });
    const surfaced = await client.waitFor("error.surfaced", {
      timeoutMs: 10_000,
      predicate: (frame) => (frame.payload as { code?: string }).code === "goal.action.unsupported",
    });
    expect(surfaced.payload).toMatchObject({ runId, code: "goal.action.unsupported" });
  });

  it("publishes a fenced ACP plan replacement into the HTTP/SSE goal snapshot", async () => {
    const { runId } = await seedDirectRun();
    const now = new Date();
    await db.update(runs).set({ status: "completed", updatedAt: now }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: "goal-plan-worker",
      runId,
      type: "codex",
      status: "completed",
      cwd: "/tmp",
      createdAt: now,
      updatedAt: now,
    });
    await mutate(`/api/runs/${runId}/goal`, "PUT", {
      goalId: "goal-1", expectedRevision: 0, operationId: "op-set", objective: "Track provider plans",
    });
    const attached = await goalControl.attachLease({
      runId,
      goalId: "goal-1",
      expectedRevision: 1,
      workerId: "goal-plan-worker",
      acpSessionId: "session-1",
    });
    expect(attached).toMatchObject({ ok: true, snapshot: { revision: 2, leaseGeneration: 1 } });
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const update = await handleAcpGoalSessionUpdateForWorker({
      workerId: "goal-plan-worker",
      sessionId: "session-1",
      update: {
        sessionUpdate: "plan",
        entries: [
          { content: "Inspect", status: "completed" },
          { content: "Implement", status: "in_progress" },
        ],
      },
    });
    expect(update).toMatchObject({ kind: "accepted", revision: 3 });
    const frame = await client.waitFor("goal.plan.updated", { timeoutMs: 10_000 });
    expect(frame.payload).toMatchObject({
      runId,
      revision: 3,
      snapshot: { plan: [{ title: "Inspect", status: "completed" }, { title: "Implement", status: "in_progress" }] },
    });
    const loaded = await client.getJson<{ goal: { revision: number; plan: Array<{ title: string }> } }>(`/api/runs/${runId}/goal`);
    expect(loaded.body.goal).toMatchObject({ revision: 3, plan: [{ title: "Inspect" }, { title: "Implement" }] });
  });
});
