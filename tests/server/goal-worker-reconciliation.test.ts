import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, dbClient } from "@/server/db";
import { plans, runGoalOperations, runGoalOutbox, runGoals, runs, workers } from "@/server/db/schema";
import {
  handleAcpGoalSessionUpdateForWorker,
  initializeWorkerGoalSession,
} from "@/server/agent-runtime/acp/goal-state";
import { goalControl } from "@/server/runs/goal-control";
import { recoverPendingGoalControlsAtStartup } from "@/server/runs/goal-control-dispatch";

const bridgeMocks = vi.hoisted(() => ({
  getAgent: vi.fn(),
  invokeAgentAcpMethod: vi.fn(),
  askAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => bridgeMocks);

describe("goal worker reconciliation", () => {
  beforeEach(async () => {
    await db.delete(runGoalOutbox);
    await db.delete(runGoalOperations);
    await db.delete(runGoals);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    const now = Date.now();
    await dbClient.batch([
      { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["goal-worker-plan", "/tmp/goal-worker.md", "running", now, now] },
      { sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["goal-worker-run", "goal-worker-plan", "running", now, now] },
      { sql: "INSERT INTO workers (id, run_id, type, status, cwd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ["goal-worker", "goal-worker-run", "codex", "idle", "/tmp", now, now] },
    ], "write");
    await goalControl.putGoal({
      runId: "goal-worker-run",
      goalId: "goal-1",
      expectedRevision: 0,
      operationId: "goal-worker-op",
      principalId: "test",
      endpoint: "goal.put",
      objective: "Reconcile the worker",
    });
    bridgeMocks.getAgent.mockReset();
    bridgeMocks.invokeAgentAcpMethod.mockReset();
    bridgeMocks.askAgent.mockReset();
  });

  it("attaches and applies a durable goal only once for one worker session revision", async () => {
    const dispatch = vi.fn(async () => ({ kind: "dispatched" as const, method: "extension" as const }));
    const first = await initializeWorkerGoalSession("goal-worker", "session-1", { dispatch });
    const second = await initializeWorkerGoalSession("goal-worker", "session-1", { dispatch });

    expect(first).toMatchObject({ kind: "accepted", snapshot: { revision: 2, leaseGeneration: 1 } });
    expect(second).toMatchObject({ kind: "accepted", snapshot: { revision: 2, leaseGeneration: 1 } });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("replays a committed but undispatched control during startup recovery", async () => {
    const attached = await goalControl.attachLease({
      runId: "goal-worker-run",
      goalId: "goal-1",
      expectedRevision: 1,
      workerId: "goal-worker",
      acpSessionId: "session-1",
    });
    if (!attached.ok) throw new Error(attached.message);
    bridgeMocks.getAgent.mockResolvedValue({
      agentCapabilities: { _meta: { goal: { version: 1, capabilities: { set: true } } } },
    });
    bridgeMocks.invokeAgentAcpMethod.mockResolvedValue({ ok: true });

    await recoverPendingGoalControlsAtStartup();

    expect(bridgeMocks.invokeAgentAcpMethod).toHaveBeenCalledWith(
      "goal-worker",
      "_session/goal",
      expect.objectContaining({
        sessionId: "session-1",
        goalId: "goal-1",
        revision: 2,
        action: "set",
        objective: "Reconcile the worker",
      }),
    );
    expect(await goalControl.isControlSettled(attached.snapshot)).toBe(true);
  });

  it("accepts normalized metadata and plan updates only from the current lease", async () => {
    const dispatch = vi.fn(async () => ({ kind: "dispatched" as const, method: "extension" as const }));
    await initializeWorkerGoalSession("goal-worker", "session-1", { dispatch });
    const metadata = await handleAcpGoalSessionUpdateForWorker({
      workerId: "goal-worker",
      sessionId: "session-1",
      update: {
        sessionUpdate: "session_info",
        _meta: { goal: { version: 1, status: "in_progress", capabilities: { pause: true, resume: true, clear: true } } },
      },
    });
    expect(metadata).toMatchObject({ kind: "accepted", revision: 3 });

    const fallback = await handleAcpGoalSessionUpdateForWorker({
      workerId: "goal-worker",
      sessionId: "session-1",
      update: {
        sessionUpdate: "available_commands_update",
        availableCommands: [{ name: "goal" }, { name: "goal pause" }, { name: "goal resume" }],
      },
    });
    expect(fallback).toMatchObject({ kind: "accepted", revision: 4 });

    const plan = await handleAcpGoalSessionUpdateForWorker({
      workerId: "goal-worker",
      sessionId: "session-1",
      update: { sessionUpdate: "plan", entries: [{ content: "Inspect", status: "in_progress" }] },
    });
    expect(plan).toMatchObject({ kind: "accepted", revision: 5 });
    expect(await goalControl.getGoal("goal-worker-run")).toMatchObject({
      status: "pursuing",
      plan: [{ title: "Inspect", status: "in_progress" }],
    });

    await initializeWorkerGoalSession("goal-worker", "session-2", { dispatch });
    const stale = await handleAcpGoalSessionUpdateForWorker({
      workerId: "goal-worker",
      sessionId: "session-1",
      update: { sessionUpdate: "plan", entries: [{ content: "Stale", status: "completed" }] },
    });
    expect(stale).toMatchObject({ kind: "rejected", reason: "stale_lease" });
    expect((await goalControl.getGoal("goal-worker-run"))?.plan[0]?.title).toBe("Inspect");
  });

  it("creates canonical state when a provider first announces a goal", async () => {
    await db.delete(runGoalOutbox);
    await db.delete(runGoalOperations);
    await db.delete(runGoals);
    const result = await handleAcpGoalSessionUpdateForWorker({
      workerId: "goal-worker",
      sessionId: "session-provider",
      update: {
        sessionUpdate: "session_info",
        _meta: {
          goal: {
            version: 1,
            goalId: "provider-goal",
            objective: "Announced by the provider",
            status: "in_progress",
            capabilities: { set: true, edit: true, clear: true },
          },
        },
      },
    });
    expect(result).toMatchObject({ kind: "accepted", revision: 3 });
    expect(await goalControl.getGoal("goal-worker-run")).toMatchObject({
      goalId: "goal-worker-run:provider-goal",
      objective: "Announced by the provider",
      status: "pursuing",
      workerId: "goal-worker",
      acpSessionId: "session-provider",
      leaseGeneration: 1,
    });
  });
});
