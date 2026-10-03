/**
 * Reported regression from session d06affd28dec: after a Codex usage limit
 * reset, pressing Resume answered "The goal could not be updated. Try again."
 * Codex had in fact resumed at once. codex-acp answers `_session/goal` resume
 * only when the turn the resume starts ends — for a goal, the whole job — and
 * forwards a turn's output only for turns a prompt started, so the request hung
 * until the UI gave up and the first minutes of the turn never reached the
 * conversation. Resume now goes through the `/goal resume` prompt and answers
 * once the runtime has taken it.
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

const WORKER_ID = "goal-codex-worker";
const SESSION_ID = "goal-codex-session";

let server: LifecycleServer;
let client: LifecycleClient;

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
  // Codex: goal controls over the extension, and `/goal` as a slash command.
  mockGetAgent.mockImplementation(async () => ({
    agentCapabilities: {
      _meta: { goal: { version: 1, capabilities: { set: true, pause: true, resume: true, clear: true } } },
    },
    outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
  }));
  // Both channels take the control and then hold the request for the turn.
  mockInvokeAgentAcpMethod.mockImplementation(() => new Promise(() => {}));
  mockAskAgent.mockImplementation((_workerId: string, _prompt: string, _images: unknown, options?: { onAccepted?: () => void }) => {
    options?.onAccepted?.();
    return new Promise(() => {});
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

async function seedLimitedGoal() {
  const { runId } = await seedDirectRun();
  const now = new Date();
  await db.insert(workers).values({
    id: WORKER_ID,
    runId,
    type: "codex",
    status: "idle",
    cwd: "/tmp",
    createdAt: now,
    updatedAt: now,
  });
  await mutate(`/api/runs/${runId}/goal`, "PUT", {
    goalId: "goal-1",
    expectedRevision: 0,
    operationId: "op-set",
    objective: "Fully implement the face retouch plan",
  });
  const attached = await goalControl.attachLease({
    runId,
    goalId: "goal-1",
    expectedRevision: 1,
    workerId: WORKER_ID,
    acpSessionId: SESSION_ID,
  });
  expect(attached).toMatchObject({ ok: true });
  const attachedSnapshot = (attached as { snapshot: { revision: number; leaseGeneration: number } }).snapshot;
  // Codex reports the usage limit as a `limited` goal.
  const limited = await goalControl.applyProviderUpdate({
    runId,
    goalId: "goal-1",
    expectedRevision: attachedSnapshot.revision,
    workerId: WORKER_ID,
    acpSessionId: SESSION_ID,
    leaseGeneration: attachedSnapshot.leaseGeneration,
    status: "limited",
    capabilities: { set: true, edit: true, pause: true, resume: true, clear: true, fallbackMethod: "/goal" },
  });
  expect(limited).toMatchObject({ ok: true, snapshot: { status: "limited" } });
  return { runId, revision: (limited as { snapshot: { revision: number } }).snapshot.revision };
}

describe("lifecycle — resuming a Codex goal whose turn runs long", () => {
  it("answers the resume once Codex has taken it, while the resumed turn keeps running", async () => {
    const { runId, revision } = await seedLimitedGoal();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    mockAskAgent.mockClear();

    const resumed = await mutate(`/api/runs/${runId}/goal/actions`, "POST", {
      goalId: "goal-1",
      expectedRevision: revision,
      operationId: "op-resume",
      action: "resume",
    });

    expect(resumed.status).toBe(200);
    expect(await resumed.json()).toMatchObject({
      goal: { status: "pursuing", lastError: null },
      control: { kind: "dispatched", method: "slash" },
    });
    expect(mockAskAgent).toHaveBeenCalledWith(WORKER_ID, "/goal resume", undefined, expect.anything());
    expect(mockInvokeAgentAcpMethod).not.toHaveBeenCalled();
    const stored = await db.select().from(runGoals).where(eq(runGoals.runId, runId)).get();
    expect(stored).toMatchObject({ status: "pursuing", lastError: null });
    expect(stored?.controlMethod).toContain("slash");
    await client.waitFor("goal.resumed");
  });
});
