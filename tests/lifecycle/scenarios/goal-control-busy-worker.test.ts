/**
 * Reported regression from session 38042c25cfbe: resuming a goal while the
 * worker was mid-turn answered "The goal could not be updated. Try again." and
 * recorded `Ask failed: Agent is busy: 38042c25cfbe-worker-1` on the goal. The
 * `/goal` slash fallback is a prompt, and the runtime refuses a prompt while
 * the agent works — but that refusal was filed as a transport failure, which
 * burned the goal into `error` and made every retry during the turn repeat it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  artifactStreams,
  executionEvents,
  recoveryIncidents,
  runGoalOperations,
  runGoalOutbox,
  runGoals,
  workers,
} from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { goalControl } from "@/server/runs/goal-control";
import { retryDeferredGoalControl } from "@/server/runs/goal-control-dispatch";
import { eventsRouteModule, goalRouteModule } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";

const { mockAskAgent, mockGetAgent, mockInvokeAgentAcpMethod } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockInvokeAgentAcpMethod: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  invokeAgentAcpMethod: mockInvokeAgentAcpMethod,
  BRIDGE_URL: "http://localhost:0",
}));

const WORKER_ID = "goal-busy-worker";
const SESSION_ID = "goal-busy-session";

let server: LifecycleServer;
let client: LifecycleClient;
let workerBusy = true;

async function clearGoalState() {
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
  mockAskAgent.mockReset();
  mockGetAgent.mockReset();
  mockInvokeAgentAcpMethod.mockReset();
  workerBusy = true;
  // An agent that advertises `/goal` and no goal extension — the shape the
  // reported session had, so control goes through the slash fallback.
  mockGetAgent.mockImplementation(async () => ({
    agentCapabilities: {},
    outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
  }));
  mockAskAgent.mockImplementation(async () => {
    if (workerBusy) throw new Error(`Ask failed: Agent is busy: ${WORKER_ID}`);
    return { response: "Goal resumed.", state: "idle" };
  });
  await clearGoalState();
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
  await clearGoalState();
});

function mutate(path: string, method: "PUT" | "POST", body: unknown) {
  return client.fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedLeasedGoal() {
  const { runId } = await seedDirectRun();
  const now = new Date();
  await db.insert(workers).values({
    id: WORKER_ID,
    runId,
    type: "codex",
    status: "working",
    cwd: "/tmp",
    createdAt: now,
    updatedAt: now,
  });
  await mutate(`/api/runs/${runId}/goal`, "PUT", {
    goalId: "goal-1",
    expectedRevision: 0,
    operationId: "op-set",
    objective: "Finish the carousel pipeline",
  });
  const attached = await goalControl.attachLease({
    runId,
    goalId: "goal-1",
    expectedRevision: 1,
    workerId: WORKER_ID,
    acpSessionId: SESSION_ID,
  });
  expect(attached).toMatchObject({ ok: true });
  return { runId, revision: (attached as { snapshot: { revision: number } }).snapshot.revision };
}

describe("lifecycle — goal control against a busy worker", () => {
  it("keeps the goal intact when the agent refuses control mid-turn, then applies it once the turn settles", async () => {
    const { runId, revision } = await seedLeasedGoal();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const resumed = await mutate(`/api/runs/${runId}/goal/actions`, "POST", {
      goalId: "goal-1",
      expectedRevision: revision,
      operationId: "op-retry",
      action: "retry",
    });

    expect(resumed.status).toBe(200);
    const body = await resumed.json() as { goal: { status: string; lastError: string | null } };
    expect(body.goal).toMatchObject({ status: "pursuing", lastError: null });
    const stored = await db.select().from(runGoals).where(eq(runGoals.runId, runId)).get();
    expect(stored).toMatchObject({ status: "pursuing", lastError: null, controlMethod: null });
    expect(mockAskAgent).toHaveBeenCalledWith(WORKER_ID, "/goal Finish the carousel pipeline");

    // The turn settles: the same control lands without the user asking again.
    workerBusy = false;
    const replayed = await retryDeferredGoalControl(runId);

    expect(replayed).toMatchObject({ kind: "dispatched", method: "slash" });
    expect(mockAskAgent).toHaveBeenLastCalledWith(WORKER_ID, "/goal Finish the carousel pipeline");
    const settled = await db.select().from(runGoals).where(eq(runGoals.runId, runId)).get();
    expect(settled).toMatchObject({ status: "pursuing", lastError: null });
    expect(settled?.controlMethod).toContain("slash");
  });

  it("still records a real transport failure on the goal", async () => {
    const { runId, revision } = await seedLeasedGoal();
    mockAskAgent.mockImplementation(async () => {
      throw new Error("Ask failed: fetch failed (caused by: read ECONNRESET)");
    });

    const failed = await mutate(`/api/runs/${runId}/goal/actions`, "POST", {
      goalId: "goal-1",
      expectedRevision: revision,
      operationId: "op-retry",
      action: "retry",
    });

    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({ error: { code: "goal.acp.transport_failed" } });
    const stored = await db.select().from(runGoals).where(eq(runGoals.runId, runId)).get();
    expect(stored).toMatchObject({ status: "error", controlMethod: "transport" });
  });
});
