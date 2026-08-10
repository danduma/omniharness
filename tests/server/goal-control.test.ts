import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeDatabaseSchema } from "@/server/db";
import { createGoalControlService } from "@/server/runs/goal-control";

const clients: ReturnType<typeof createClient>[] = [];
const tempRoots: string[] = [];

async function seedRun(client: ReturnType<typeof createClient>, runId = "run-1") {
  const now = Date.now();
  await client.batch([
    { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: [`plan-${runId}`, "/tmp/plan.md", "running", now, now] },
    { sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: [runId, `plan-${runId}`, "running", now, now] },
    { sql: "INSERT INTO workers (id, run_id, type, status, cwd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ["worker-1", runId, "codex", "idle", "/tmp", now, now] },
  ], "write");
}

describe("GoalControlService", () => {
  let client: ReturnType<typeof createClient>;
  let id = 0;

  beforeEach(async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-goal-control-"));
    tempRoots.push(tempRoot);
    client = createClient({ url: `file:${path.join(tempRoot, "sqlite.db")}` });
    clients.push(client);
    await initializeDatabaseSchema(client);
    await seedRun(client);
    id = 0;
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((candidate) => candidate.close()));
    for (const tempRoot of tempRoots.splice(0)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  function service() {
    return createGoalControlService(client, {
      now: () => new Date("2026-08-10T10:00:00.000Z"),
      randomId: () => `generated-${++id}`,
    });
  }

  it("creates a pending goal, operation result, and outbox row atomically", async () => {
    const result = await service().putGoal({
      runId: "run-1",
      goalId: "goal-1",
      expectedRevision: 0,
      operationId: "op-1",
      objective: "Ship durable goals",
      principalId: "principal-1",
      endpoint: "goal.put",
    });

    expect(result).toMatchObject({ ok: true, replayed: false, snapshot: {
      goalId: "goal-1",
      revision: 1,
      status: "pending",
      visible: true,
    } });
    const operations = await client.execute("SELECT * FROM run_goal_operations");
    const outbox = await client.execute("SELECT * FROM run_goal_outbox");
    expect(operations.rows).toHaveLength(1);
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({
      event_key: "run-1/1/goal.set.completed",
      status: "pending",
    });
  });

  it("replays an identical operation without another revision or outbox row", async () => {
    const input = {
      runId: "run-1",
      goalId: "goal-1",
      expectedRevision: 0,
      operationId: "op-1",
      objective: "Ship durable goals",
      principalId: "principal-1",
      endpoint: "goal.put" as const,
    };
    const control = service();
    await control.putGoal(input);
    const replay = await control.putGoal(input);

    expect(replay).toMatchObject({ ok: true, replayed: true, snapshot: { revision: 1 } });
    expect(Number((await client.execute("SELECT COUNT(*) AS count FROM run_goal_outbox")).rows[0]?.count)).toBe(1);
  });

  it("rejects operation-id reuse with a different principal or payload", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "First", principalId: "principal-1", endpoint: "goal.put",
    });
    const conflict = await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1, operationId: "op-1",
      objective: "Second", principalId: "principal-2", endpoint: "goal.put",
    });

    expect(conflict).toMatchObject({ ok: false, code: "operation_conflict", snapshot: { revision: 1 } });
  });

  it("returns the newest snapshot for a stale revision without mutation", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "First", principalId: "principal-1", endpoint: "goal.put",
    });
    const stale = await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-2",
      objective: "Second", principalId: "principal-1", endpoint: "goal.put",
    });

    expect(stale).toMatchObject({ ok: false, code: "revision_conflict", snapshot: { revision: 1, objective: "First" } });
    expect((await control.getGoal("run-1"))?.objective).toBe("First");
  });

  it("fences provider updates by goal, session, and lease generation", async () => {
    const control = service();
    const created = await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "First", principalId: "principal-1", endpoint: "goal.put",
    });
    expect(created.ok).toBe(true);
    const attached = await control.attachLease({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1,
      workerId: "worker-1", acpSessionId: "session-1",
    });
    expect(attached).toMatchObject({ ok: true, snapshot: { revision: 2, leaseGeneration: 1 } });

    const stale = await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: 2,
      workerId: "worker-1", acpSessionId: "session-old", leaseGeneration: 0,
      status: "pursuing",
    });
    expect(stale).toMatchObject({ ok: false, code: "stale_lease", snapshot: { revision: 2 } });

    const accepted = await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: 2,
      workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: 1,
      status: "pursuing",
    });
    expect(accepted).toMatchObject({ ok: true, snapshot: { revision: 3, status: "pursuing" } });
  });

  it("keeps a clear tombstone terminal when a delayed provider update arrives", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "First", principalId: "principal-1", endpoint: "goal.put",
    });
    await control.attachLease({ runId: "run-1", goalId: "goal-1", expectedRevision: 1, workerId: "worker-1", acpSessionId: "session-1" });
    const cleared = await control.actionGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 2, operationId: "op-clear",
      action: "clear", principalId: "principal-1", endpoint: "goal.actions",
    });
    expect(cleared).toMatchObject({ ok: true, snapshot: { status: "cleared", visible: false, revision: 3 } });

    const delayed = await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: 3,
      workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: 1,
      status: "pursuing",
    });
    expect(delayed).toMatchObject({ ok: false, code: "invalid_transition", snapshot: { status: "cleared", revision: 3 } });
    expect(await control.getGoal("run-1")).toMatchObject({ status: "cleared", visible: false, revision: 3 });
  });
});
