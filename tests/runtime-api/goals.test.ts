import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { plans, runGoalOperations, runGoalOutbox, runGoals, runs } from "@/server/db/schema";
import { handleGoalRequest } from "@/runtime/http/routes/goals";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

const runId = "goal-api-run";

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
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    await db.delete(runGoalOutbox);
    await db.delete(runGoalOperations);
    await db.delete(runGoals);
    await db.delete(runs);
    await db.delete(plans);
    const now = new Date();
    await db.insert(plans).values({ id: "goal-api-plan", path: "/tmp/goal-plan.md", status: "running", createdAt: now, updatedAt: now });
    await db.insert(runs).values({ id: runId, planId: "goal-api-plan", status: "running", createdAt: now, updatedAt: now });
    __resetNamedEventsForTests();
  });

  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
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
  });
});
