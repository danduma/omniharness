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
  let databaseUrl: string;
  let id = 0;

  beforeEach(async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-goal-control-"));
    tempRoots.push(tempRoot);
    databaseUrl = `file:${path.join(tempRoot, "sqlite.db")}`;
    client = createClient({ url: databaseUrl });
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

  it("treats a same-objective edit as a no-op without revision churn", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-create",
      objective: "Same objective", principalId: "principal-1", endpoint: "goal.put",
    });
    const unchanged = await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1, operationId: "op-same",
      objective: "Same objective", principalId: "principal-1", endpoint: "goal.put",
    });

    expect(unchanged).toMatchObject({ ok: true, replayed: true, snapshot: { revision: 1 } });
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

  it("requires the dispatch coordinator to re-read after a same-lease provider revision wins the response race", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "Race the acknowledgement", principalId: "principal-1", endpoint: "goal.put",
    });
    const attached = await control.attachLease({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1,
      workerId: "worker-1", acpSessionId: "session-1",
    });
    if (!attached.ok) throw new Error(attached.message);
    const providerUpdate = await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: attached.snapshot.revision,
      workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: attached.snapshot.leaseGeneration,
      status: "pursuing",
    });
    if (!providerUpdate.ok) throw new Error(providerUpdate.message);

    expect(await control.markControlApplied(attached.snapshot, "extension")).toBe(false);
    expect(await control.isControlSettled(providerUpdate.snapshot)).toBe(false);
  });

  it("does not settle a newer API mutation with an older dispatched control", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "First command", principalId: "principal-1", endpoint: "goal.put",
    });
    const attached = await control.attachLease({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1,
      workerId: "worker-1", acpSessionId: "session-1",
    });
    if (!attached.ok) throw new Error(attached.message);
    const edited = await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: attached.snapshot.revision,
      operationId: "op-edit", objective: "Second command", principalId: "principal-1", endpoint: "goal.put",
    });
    if (!edited.ok) throw new Error(edited.message);

    expect(await control.markControlApplied(attached.snapshot, "extension")).toBe(false);
    expect(await control.isControlSettled(edited.snapshot)).toBe(false);
  });

  it("requires an explicit passed validation before provider completion", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "Validate before completing", principalId: "principal-1", endpoint: "goal.put",
    });
    await control.attachLease({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1,
      workerId: "worker-1", acpSessionId: "session-1",
    });
    await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: 2,
      workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: 1,
      status: "pursuing",
    });
    const validating = await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: 3,
      workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: 1,
      status: "validating",
      validationState: { status: "validating", message: null, updatedAt: "2026-08-10T10:00:00.000Z" },
    });
    expect(validating).toMatchObject({ ok: true, snapshot: { revision: 4, status: "validating" } });

    const premature = await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: 4,
      workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: 1,
      status: "completed",
    });
    expect(premature).toMatchObject({ ok: false, code: "invalid_transition", snapshot: { revision: 4, status: "validating" } });

    const completed = await control.applyProviderUpdate({
      runId: "run-1", goalId: "goal-1", expectedRevision: 4,
      workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: 1,
      status: "completed",
      validationState: { status: "passed", message: null, updatedAt: "2026-08-10T10:00:00.000Z" },
    });
    expect(completed).toMatchObject({
      ok: true,
      snapshot: { revision: 5, status: "completed", validationState: { status: "passed" } },
    });
    expect((await client.execute(
      "SELECT event_kind, revision FROM run_goal_outbox WHERE revision IN (4, 5) ORDER BY revision",
    )).rows).toEqual([
      expect.objectContaining({ event_kind: "goal.validation.started", revision: 4 }),
      expect.objectContaining({ event_kind: "goal.completed", revision: 5 }),
    ]);
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

  it("replaces a cleared tombstone only with a new goal id and later run revision", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-create",
      objective: "First goal", principalId: "principal-1", endpoint: "goal.put",
    });
    await control.actionGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1, operationId: "op-clear",
      action: "clear", principalId: "principal-1", endpoint: "goal.actions",
    });

    const sameId = await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 2, operationId: "op-revive",
      objective: "Do not revive", principalId: "principal-1", endpoint: "goal.put",
    });
    expect(sameId).toMatchObject({ ok: false, code: "invalid_transition", snapshot: { revision: 2, status: "cleared" } });

    const replacement = await control.putGoal({
      runId: "run-1", goalId: "goal-2", expectedRevision: 2, operationId: "op-replace",
      objective: "Second goal", principalId: "principal-1", endpoint: "goal.put",
    });
    expect(replacement).toMatchObject({
      ok: true,
      snapshot: { goalId: "goal-2", objective: "Second goal", revision: 3, status: "pending", visible: true },
    });
    expect((await client.execute("SELECT event_kind, revision FROM run_goal_outbox ORDER BY revision")).rows).toEqual([
      expect.objectContaining({ event_kind: "goal.set.completed", revision: 1 }),
      expect.objectContaining({ event_kind: "goal.cleared", revision: 2 }),
      expect.objectContaining({ event_kind: "goal.set.completed", revision: 3 }),
    ]);
  });

  it("persists invalid operation results for deterministic replay", async () => {
    const control = service();
    const input = {
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-invalid",
      objective: " ", principalId: "principal-1", endpoint: "goal.put" as const,
    };
    expect(await control.putGoal(input)).toMatchObject({ ok: false, code: "invalid_objective" });
    expect(await control.putGoal(input)).toMatchObject({ ok: false, code: "invalid_objective" });
    expect((await client.execute("SELECT status FROM run_goal_operations WHERE operation_id = 'op-invalid'")).rows[0]).toMatchObject({ status: "rejected" });
  });

  it("records provider control failure as a new visible canonical revision", async () => {
    const control = service();
    await control.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "First", principalId: "principal-1", endpoint: "goal.put",
    });
    const attached = await control.attachLease({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1, workerId: "worker-1", acpSessionId: "session-1",
    });
    if (!attached.ok) throw new Error(attached.message);
    const failed = await control.recordControlFailure(attached.snapshot, "transport", "Connection lost");
    expect(failed).toMatchObject({ ok: true, snapshot: { revision: 3, status: "error", lastError: "Connection lost" } });
  });

  it("serializes simultaneous production-engine edits with exactly one CAS winner", async () => {
    const first = service();
    await first.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-create",
      objective: "Initial", principalId: "principal-1", endpoint: "goal.put",
    });
    const peerClient = createClient({ url: databaseUrl });
    clients.push(peerClient);
    const peer = createGoalControlService(peerClient);
    const results = await Promise.all([
      first.putGoal({
        runId: "run-1", goalId: "goal-1", expectedRevision: 1, operationId: "op-edit-a",
        objective: "Edit A", principalId: "principal-1", endpoint: "goal.put",
      }),
      peer.putGoal({
        runId: "run-1", goalId: "goal-1", expectedRevision: 1, operationId: "op-edit-b",
        objective: "Edit B", principalId: "principal-1", endpoint: "goal.put",
      }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      expect.objectContaining({ ok: false, code: "revision_conflict", snapshot: expect.objectContaining({ revision: 2 }) }),
    ]);
  });

  it("atomically deduplicates concurrent inserts of one operation id", async () => {
    const peerClient = createClient({ url: databaseUrl });
    clients.push(peerClient);
    const input = {
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-shared",
      objective: "One mutation", principalId: "principal-1", endpoint: "goal.put" as const,
    };
    const results = await Promise.all([
      service().putGoal(input),
      createGoalControlService(peerClient).putGoal(input),
    ]);
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ ok: true, replayed: false, snapshot: expect.objectContaining({ revision: 1 }) }),
      expect.objectContaining({ ok: true, replayed: true, snapshot: expect.objectContaining({ revision: 1 }) }),
    ]));
    expect(Number((await client.execute("SELECT COUNT(*) AS count FROM run_goal_operations")).rows[0]?.count)).toBe(1);
    expect(Number((await client.execute("SELECT COUNT(*) AS count FROM run_goal_outbox")).rows[0]?.count)).toBe(1);
  });

  it("fences a concurrent clear against a provider update without losing either decision", async () => {
    const first = service();
    await first.putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-create",
      objective: "Race safely", principalId: "principal-1", endpoint: "goal.put",
    });
    const attached = await first.attachLease({
      runId: "run-1", goalId: "goal-1", expectedRevision: 1, workerId: "worker-1", acpSessionId: "session-1",
    });
    if (!attached.ok) throw new Error(attached.message);
    const peerClient = createClient({ url: databaseUrl });
    clients.push(peerClient);
    const peer = createGoalControlService(peerClient);
    const results = await Promise.all([
      first.actionGoal({
        runId: "run-1", goalId: "goal-1", expectedRevision: 2, operationId: "op-clear",
        action: "clear", principalId: "principal-1", endpoint: "goal.actions",
      }),
      peer.applyProviderUpdate({
        runId: "run-1", goalId: "goal-1", expectedRevision: 2,
        workerId: "worker-1", acpSessionId: "session-1", leaseGeneration: 1,
        status: "pursuing",
      }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)[0]).toMatchObject({
      ok: false,
      code: expect.stringMatching(/revision_conflict|stale_lease|invalid_transition/),
      snapshot: expect.objectContaining({ revision: 3 }),
    });
    expect((await first.getGoal("run-1"))?.revision).toBe(3);
  });
});
