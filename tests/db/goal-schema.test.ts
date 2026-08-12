import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabaseSchema } from "@/server/db";
import * as schema from "@/server/db/schema";

const clients: ReturnType<typeof createClient>[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function createDatabase() {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await initializeDatabaseSchema(client);
  return client;
}

describe("goal control schema", () => {
  it("exports all goal control-plane tables", () => {
    expect(schema).toHaveProperty("runGoals");
    expect(schema).toHaveProperty("runGoalOperations");
    expect(schema).toHaveProperty("runGoalOutbox");
  });

  it("initializes the three tables and their ordering/idempotency indexes", async () => {
    const client = await createDatabase();
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    const tableNames = tables.rows.map((row) => String(row.name));
    expect(tableNames).toEqual(expect.arrayContaining([
      "run_goals",
      "run_goal_operations",
      "run_goal_outbox",
    ]));

    const operationIndexes = await client.execute("PRAGMA index_list(run_goal_operations)");
    expect(operationIndexes.rows.some((row) => Number(row.unique) === 1)).toBe(true);
    const outboxIndexes = await client.execute("PRAGMA index_list(run_goal_outbox)");
    expect(outboxIndexes.rows.some((row) => Number(row.unique) === 1)).toBe(true);
  });

  it("cascades goal, operation, and outbox state when a run is deleted", async () => {
    const client = await createDatabase();
    const now = Date.now();
    await client.batch([
      { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["plan-1", "/tmp/plan.md", "running", now, now] },
      { sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["run-1", "plan-1", "running", now, now] },
      { sql: "INSERT INTO run_goals (run_id, goal_id, objective, status, revision, lease_generation, plan_json, plan_source_json, capabilities_json, visible, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: ["run-1", "goal-1", "Ship it", "pending", 1, 0, "[]", '{"kind":"none"}', "{}", 1, now, now] },
      { sql: "INSERT INTO run_goal_operations (run_id, operation_id, principal_id, endpoint, action, fingerprint, status, result_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: ["run-1", "op-1", "local", "goal.put", "set", "abc", "committed", "{}", now, now] },
      { sql: "INSERT INTO run_goal_outbox (id, run_id, goal_id, lease_generation, revision, event_key, event_kind, payload_json, status, attempt_count, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: ["out-1", "run-1", "goal-1", 0, 1, "run-1/1/goal.set.completed", "goal.set.completed", "{}", "pending", 0, now, now, now] },
    ], "write");

    await client.execute({ sql: "DELETE FROM runs WHERE id = ?", args: ["run-1"] });

    for (const table of ["run_goals", "run_goal_operations", "run_goal_outbox"]) {
      const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      expect(Number(result.rows[0]?.count)).toBe(0);
    }
  });

  it("upgrades a version-six database additively without changing existing runs", async () => {
    const client = await createDatabase();
    const now = Date.now();
    await client.batch([
      { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["legacy-plan", "/tmp/legacy.md", "running", now, now] },
      { sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["legacy-run", "legacy-plan", "running", now, now] },
    ], "write");
    await client.executeMultiple(`
      DROP TABLE run_goal_outbox;
      DROP TABLE run_goal_operations;
      DROP TABLE run_goals;
      PRAGMA user_version = 6;
    `);

    await initializeDatabaseSchema(client);

    expect((await client.execute("PRAGMA user_version")).rows[0]?.user_version).toBe(7);
    expect((await client.execute("SELECT status FROM runs WHERE id = 'legacy-run'")).rows[0]).toMatchObject({ status: "running" });
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'run_goal%'");
    expect(tables.rows.map((row) => row.name).sort()).toEqual(["run_goal_operations", "run_goal_outbox", "run_goals"]);
  });
});
