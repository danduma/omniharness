import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabaseSchema } from "@/server/db";

const roots: string[] = [];

// `mode: 'timestamp'` columns store unix *seconds*, not milliseconds.
const T0 = Math.floor(Date.now() / 1000);

async function freshDb(): Promise<Client> {
  const root = mkdtempSync(path.join(tmpdir(), "omni-run-activity-"));
  roots.push(root);
  const client = createClient({ url: `file:${path.join(root, "sqlite.db")}` });
  await initializeDatabaseSchema(client);
  return client;
}

async function seedRun(client: Client, id: string, createdAt: number) {
  await client.execute({
    sql: "INSERT OR IGNORE INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, 'done', ?, ?)",
    args: [`plan-${id}`, `/tmp/${id}`, createdAt, createdAt],
  });
  await client.execute({
    sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, 'running', ?, ?)",
    args: [id, `plan-${id}`, createdAt, createdAt],
  });
}

async function activityOf(client: Client, runId: string) {
  const result = await client.execute({
    sql: "SELECT last_activity_at FROM runs WHERE id = ?",
    args: [runId],
  });
  return Number(result.rows[0]?.last_activity_at);
}

describe("runs.last_activity_at", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("seeds new runs with their creation time", async () => {
    const client = await freshDb();
    await seedRun(client, "run-a", T0);

    expect(await activityOf(client, "run-a")).toBe(T0);
    await client.close();
  });

  it("advances on a user message", async () => {
    const client = await freshDb();
    await seedRun(client, "run-a", T0);

    await client.execute({
      sql: "INSERT INTO messages (id, run_id, role, kind, content, created_at) VALUES (?, ?, 'user', 'checkpoint', 'hi', ?)",
      args: ["msg-1", "run-a", T0 + 100],
    });

    expect(await activityOf(client, "run-a")).toBe(T0 + 100);
    await client.close();
  });

  it("advances when an agent turn finishes", async () => {
    const client = await freshDb();
    await seedRun(client, "run-a", T0);
    await client.execute({
      sql: "INSERT INTO workers (id, run_id, type, status, cwd, output_log, created_at, updated_at) VALUES (?, ?, 'claude', 'working', '/tmp', '', ?, ?)",
      args: ["worker-1", "run-a", T0, T0],
    });

    // Mid-turn output must not count — only the transition out of `working` does.
    expect(await activityOf(client, "run-a")).toBe(T0);

    await client.execute({
      sql: "UPDATE workers SET status = 'idle', updated_at = ? WHERE id = ?",
      args: [T0 + 200, "worker-1"],
    });

    expect(await activityOf(client, "run-a")).toBe(T0 + 200);
    await client.close();
  });

  it("ignores background bookkeeping that only touches runs.updated_at", async () => {
    const client = await freshDb();
    await seedRun(client, "run-a", T0);

    await client.execute({
      sql: "UPDATE runs SET updated_at = ?, last_memory_consolidation_at = ? WHERE id = ?",
      args: [T0 + 5000, T0 + 5000, "run-a"],
    });

    expect(await activityOf(client, "run-a")).toBe(T0);
    await client.close();
  });

  it("never moves backwards when a fork copies older messages in", async () => {
    const client = await freshDb();
    await seedRun(client, "run-fork", T0 + 1000);

    await client.execute({
      sql: "INSERT INTO messages (id, run_id, role, kind, content, created_at) VALUES (?, ?, 'user', 'checkpoint', 'copied', ?)",
      args: ["msg-old", "run-fork", T0],
    });

    expect(await activityOf(client, "run-fork")).toBe(T0 + 1000);
    await client.close();
  });

  it("skips supervisor and internal rows", async () => {
    const client = await freshDb();
    await seedRun(client, "run-a", T0);

    await client.execute({
      sql: "INSERT INTO messages (id, run_id, role, kind, content, created_at) VALUES (?, ?, 'supervisor', 'update', 'noise', ?)",
      args: ["msg-sup", "run-a", T0 + 100],
    });
    await client.execute({
      sql: "INSERT INTO messages (id, run_id, role, kind, content, created_at) VALUES (?, ?, 'user', 'internal', 'noise', ?)",
      args: ["msg-int", "run-a", T0 + 200],
    });

    expect(await activityOf(client, "run-a")).toBe(T0);
    await client.close();
  });

  it("backfills pre-existing runs from messages and worker output streams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "omni-run-activity-legacy-"));
    roots.push(root);
    const client = createClient({ url: `file:${path.join(root, "sqlite.db")}` });

    // A database at the previous schema version: no last_activity_at column.
    await initializeDatabaseSchema(client);
    await client.execute("DROP TRIGGER runs_activity_seed");
    await client.execute("DROP TRIGGER runs_activity_on_user_message");
    await client.execute("DROP TRIGGER runs_activity_on_worker_turn_end");
    await seedRun(client, "run-msg", T0);
    await seedRun(client, "run-stream", T0);
    await seedRun(client, "run-quiet", T0);
    await client.execute({
      sql: "INSERT INTO messages (id, run_id, role, kind, content, created_at) VALUES (?, ?, 'user', 'checkpoint', 'hi', ?)",
      args: ["msg-1", "run-msg", T0 + 300],
    });
    await client.execute({
      sql: "INSERT INTO artifact_streams (id, run_id, kind, owner_id, relative_path, latest_seq, status, created_at, updated_at) VALUES (?, ?, 'worker_entries', 'worker-1', 'w.jsonl', 3, 'active', ?, ?)",
      args: ["stream-1", "run-stream", T0, T0 + 400],
    });
    await client.execute("UPDATE runs SET last_activity_at = NULL");

    await initializeDatabaseSchema(client);

    expect(await activityOf(client, "run-msg")).toBe(T0 + 300);
    expect(await activityOf(client, "run-stream")).toBe(T0 + 400);
    expect(await activityOf(client, "run-quiet")).toBe(T0);
    await client.close();
  });
});
