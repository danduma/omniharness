import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { plans, runGoalOperations, runGoalOutbox, runGoals, runs, workers } from "@/server/db/schema";
import { handleGoalRequest } from "@/runtime/http/routes/goals";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { goalControl } from "@/server/runs/goal-control";

const runId = "goal-api-run";

const bridgeMocks = vi.hoisted(() => ({
  getAgent: vi.fn(),
  invokeAgentAcpMethod: vi.fn(),
  askAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => bridgeMocks);

function request(method: string, body?: unknown, id = runId) {
  return new Request(`http://localhost/api/runs/${id}/goal${method === "POST" ? "/actions" : ""}`, {
    method,
    headers: method === "GET" ? undefined : { "content-type": "application/json", origin: "http://localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(method: string, body?: unknown, id = runId) {
  return handleGoalRequest(request(method, body, id), { surface: "test", params: { id } });
}

describe("run goal API", () => {
  beforeEach(async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    await db.delete(runGoalOutbox);
    await db.delete(runGoalOperations);
    await db.delete(runGoals);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    const now = new Date();
    await db.insert(plans).values({ id: "goal-api-plan", path: "/tmp/goal-plan.md", status: "running", createdAt: now, updatedAt: now });
    await db.insert(runs).values({ id: runId, planId: "goal-api-plan", status: "running", createdAt: now, updatedAt: now });
    __resetNamedEventsForTests();
    bridgeMocks.getAgent.mockReset();
    bridgeMocks.invokeAgentAcpMethod.mockReset();
    bridgeMocks.askAgent.mockReset();
  });

  afterEach(() => {
    delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
  });

  it("authenticates before revealing whether a run id exists", async () => {
    delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";

    const existing = await call("GET");
    const guessed = await call("GET", undefined, "guessed-run");
    expect(existing.status).toBe(401);
    expect(guessed.status).toBe(401);
    expect((await existing.json()).error.message).toBe((await guessed.json()).error.message);
  });

  it("returns an absent goal without disclosing missing runs as present", async () => {
    const absent = await call("GET");
    expect(absent.status).toBe(200);
    expect(await absent.json()).toEqual({ goal: null });

    const missing = await call("GET", undefined, "guessed-run");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "goal.not_found" } });
  });

  it("sets, reads, idempotently replays, and clears a durable goal", async () => {
    const setBody = {
      goalId: "goal-1",
      expectedRevision: 0,
      operationId: "op-set",
      objective: "Ship durable goals",
    };
    const created = await call("PUT", setBody);
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({ goal: { revision: 1, status: "pending" }, replayed: false });

    const replay = await call("PUT", setBody);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ goal: { revision: 1 }, replayed: true });

    const loaded = await call("GET");
    expect(await loaded.json()).toMatchObject({ goal: { objective: "Ship durable goals", revision: 1 } });

    const cleared = await call("POST", {
      goalId: "goal-1", expectedRevision: 1, operationId: "op-clear", action: "clear",
    });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ goal: { revision: 2, status: "cleared", visible: false } });

    const replaced = await call("PUT", {
      goalId: "goal-2", expectedRevision: 2, operationId: "op-replace", objective: "Ship the next goal",
    });
    expect(replaced.status).toBe(200);
    expect(await replaced.json()).toMatchObject({
      goal: { goalId: "goal-2", revision: 3, status: "pending", visible: true },
    });
  });

  it("attaches a newly set goal to the active worker session before ACP dispatch", async () => {
    const now = new Date();
    await db.insert(workers).values({
      id: "goal-worker-1",
      runId,
      type: "codex",
      status: "idle",
      cwd: "/tmp",
      bridgeSessionId: "goal-session-1",
      createdAt: now,
      updatedAt: now,
    });
    bridgeMocks.getAgent.mockResolvedValue({
      agentCapabilities: {
        _meta: { goal: { version: 1, capabilities: { set: true, edit: true, clear: true } } },
      },
    });
    bridgeMocks.invokeAgentAcpMethod.mockResolvedValue({ ok: true });

    const created = await call("PUT", {
      goalId: "goal-bound",
      expectedRevision: 0,
      operationId: "op-bound",
      objective: "Bind then dispatch",
    });

    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      goal: {
        goalId: "goal-bound",
        revision: 2,
        leaseGeneration: 1,
        workerId: "goal-worker-1",
        acpSessionId: "goal-session-1",
      },
      control: { kind: "dispatched", method: "extension" },
    });
    expect(bridgeMocks.invokeAgentAcpMethod).toHaveBeenCalledWith("goal-worker-1", "_session/goal", {
      sessionId: "goal-session-1",
      goalId: "goal-bound",
      revision: 2,
      action: "set",
      objective: "Bind then dispatch",
    });
  });

  it("recovers a replayed operation committed before ACP dispatch", async () => {
    const now = new Date();
    await db.insert(workers).values({
      id: "goal-worker-1",
      runId,
      type: "codex",
      status: "idle",
      cwd: "/tmp",
      bridgeSessionId: "goal-session-1",
      createdAt: now,
      updatedAt: now,
    });
    bridgeMocks.getAgent.mockResolvedValue({
      agentCapabilities: {
        _meta: { goal: { version: 1, capabilities: { set: true, edit: true, clear: true } } },
      },
    });
    bridgeMocks.invokeAgentAcpMethod.mockResolvedValue({ ok: true });
    const body = {
      goalId: "goal-crash-recovery",
      expectedRevision: 0,
      operationId: "op-crash-recovery",
      objective: "Recover the durable command",
    };

    expect(await goalControl.putGoal({
      runId,
      ...body,
      principalId: "local:test",
      endpoint: "goal.put",
    })).toMatchObject({ ok: true, replayed: false, snapshot: { revision: 1, workerId: null } });

    const replay = await call("PUT", body);

    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      replayed: true,
      goal: { revision: 2, workerId: "goal-worker-1", acpSessionId: "goal-session-1" },
      control: { kind: "dispatched", method: "extension" },
    });
    expect(bridgeMocks.invokeAgentAcpMethod).toHaveBeenCalledTimes(1);
    expect(bridgeMocks.invokeAgentAcpMethod).toHaveBeenCalledWith(
      "goal-worker-1",
      "_session/goal",
      expect.objectContaining({
        action: "set",
        objective: "Recover the durable command",
      }),
    );
  });

  it("returns 409 with the newest snapshot for stale revisions", async () => {
    await call("PUT", { goalId: "goal-1", expectedRevision: 0, operationId: "op-set", objective: "First" });
    const stale = await call("PUT", { goalId: "goal-1", expectedRevision: 0, operationId: "op-stale", objective: "Second" });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: { code: "goal.revision_conflict" },
      goal: { objective: "First", revision: 1 },
    });
    const events = getNamedEventsSince(0, { runId }).events.map((entry) => entry.event);
    expect(events).toContainEqual(expect.objectContaining({ kind: "goal.set.refused", reason: "revision_conflict" }));
    expect(events).toContainEqual(expect.objectContaining({ kind: "error.surfaced", code: "goal.revision_conflict" }));
  });

  it("rejects malformed and oversized requests before persistence", async () => {
    const invalid = await call("PUT", { goalId: "goal-1", expectedRevision: 0, operationId: "op-set", objective: " " });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "goal.objective.invalid" } });

    const oversized = new Request(`http://localhost/api/runs/${runId}/goal`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost", "content-length": "999999" },
      body: JSON.stringify({ goalId: "goal-1", expectedRevision: 0, operationId: "op-large", objective: "Large" }),
    });
    const response = await handleGoalRequest(oversized, { surface: "test", params: { id: runId } });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "goal.payload_too_large" } });
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({ kind: "error.surfaced", code: "goal.payload.invalid" }),
    );
  });
});
