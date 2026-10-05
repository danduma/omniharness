import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeDatabaseSchema, type DbClient } from "@/server/db";
import { createGoalControlService } from "@/server/runs/goal-control";
import { listWorkersHoldingActiveGoals, selectActiveGoalWorker } from "@/server/runs/goal-worker-lease";

function clientWithRows(rows: Array<Record<string, unknown>>) {
  return {
    execute: vi.fn(async () => ({ rows, rowsAffected: 0, lastInsertRowid: undefined })),
  } as unknown as Pick<DbClient, "execute">;
}

describe("goal active-worker lease selection", () => {
  it("keeps the current active lease instead of transferring to a newer worker", async () => {
    const client = clientWithRows([
      { id: "worker-1", status: "idle", bridge_session_id: "session-1", worker_number: 1, created_at: 1 },
      { id: "worker-2", status: "working", bridge_session_id: "session-2", worker_number: 2, created_at: 2 },
    ]);

    await expect(selectActiveGoalWorker(client, "run-1", "worker-1", "session-1")).resolves.toMatchObject({
      id: "worker-1",
      sessionId: "session-1",
    });
  });

  it("selects the newest active session while excluding terminal and sessionless workers", async () => {
    const client = clientWithRows([
      { id: "worker-old", status: "cancelled", bridge_session_id: "old-session", worker_number: 9, created_at: 9 },
      { id: "worker-sessionless", status: "working", bridge_session_id: null, worker_number: 8, created_at: 8 },
      { id: "worker-1", status: "idle", bridge_session_id: "session-1", worker_number: 1, created_at: 1 },
      { id: "worker-2", status: "recovering: bridge", bridge_session_id: "session-2", worker_number: 2, created_at: 2 },
    ]);

    await expect(selectActiveGoalWorker(client, "run-1", "worker-old", "old-session")).resolves.toMatchObject({
      id: "worker-2",
      sessionId: "session-2",
    });
  });
});

describe("listWorkersHoldingActiveGoals", () => {
  const tempRoots: string[] = [];
  const clients: ReturnType<typeof createClient>[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
    for (const tempRoot of tempRoots.splice(0)) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  async function databaseWithGoals(goals: Array<{ runId: string; workerId: string; status: string; visible?: boolean }>) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-goal-lease-"));
    tempRoots.push(tempRoot);
    const client = createClient({ url: `file:${path.join(tempRoot, "sqlite.db")}` });
    clients.push(client);
    await initializeDatabaseSchema(client);
    const service = createGoalControlService(client);
    const now = Date.now();
    for (const goal of goals) {
      await client.batch([
        { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: [`plan-${goal.runId}`, "/tmp/plan.md", "running", now, now] },
        { sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: [goal.runId, `plan-${goal.runId}`, "running", now, now] },
        { sql: "INSERT INTO workers (id, run_id, type, status, cwd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [goal.workerId, goal.runId, "claude", "idle", "/tmp", now, now] },
      ], "write");
      const created = await service.putGoal({
        runId: goal.runId,
        goalId: `goal-${goal.runId}`,
        expectedRevision: 0,
        operationId: `op-${goal.runId}`,
        objective: "Finish the plan",
        principalId: "principal-1",
        endpoint: "goal.put",
      });
      if (!created.ok) throw new Error(created.message);
      await client.execute({
        sql: "UPDATE run_goals SET status = ?, worker_id = ?, visible = ? WHERE run_id = ?",
        args: [goal.status, goal.workerId, goal.visible === false ? 0 : 1, goal.runId],
      });
    }
    return client;
  }

  it("returns only workers leased to a pending or pursuing goal", async () => {
    const client = await databaseWithGoals([
      { runId: "run-pursuing", workerId: "worker-pursuing", status: "pursuing" },
      { runId: "run-pending", workerId: "worker-pending", status: "pending" },
      { runId: "run-paused", workerId: "worker-paused", status: "paused" },
      { runId: "run-hidden", workerId: "worker-hidden", status: "pursuing", visible: false },
    ]);

    const holders = await listWorkersHoldingActiveGoals(
      ["worker-pursuing", "worker-pending", "worker-paused", "worker-hidden", "worker-unknown"],
      client,
    );

    expect([...holders].sort()).toEqual(["worker-pending", "worker-pursuing"]);
    await expect(listWorkersHoldingActiveGoals([], client)).resolves.toEqual(new Set());
  });
});
