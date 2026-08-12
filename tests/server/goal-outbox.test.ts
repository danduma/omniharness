import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDatabaseSchema } from "@/server/db";
import { createGoalControlService } from "@/server/runs/goal-control";
import { compactGoalControlHistory, createGoalOutboxDispatcher } from "@/server/runs/goal-outbox";

const clients: ReturnType<typeof createClient>[] = [];
const tempRoots: string[] = [];

describe("GoalOutboxDispatcher", () => {
  let client: ReturnType<typeof createClient>;
  let currentTime: number;

  beforeEach(async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-goal-outbox-"));
    tempRoots.push(tempRoot);
    client = createClient({ url: `file:${path.join(tempRoot, "sqlite.db")}` });
    clients.push(client);
    await initializeDatabaseSchema(client);
    currentTime = new Date("2026-08-10T10:00:00.000Z").getTime();
    await client.batch([
      { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["plan-1", "/tmp/plan.md", "running", currentTime, currentTime] },
      { sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["run-1", "plan-1", "running", currentTime, currentTime] },
    ], "write");
    await createGoalControlService(client, {
      now: () => new Date(currentTime),
      randomId: () => "outbox-1",
    }).putGoal({
      runId: "run-1", goalId: "goal-1", expectedRevision: 0, operationId: "op-1",
      objective: "Ship it", principalId: "principal-1", endpoint: "goal.put",
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(clients.splice(0).map((candidate) => candidate.close()));
    for (const tempRoot of tempRoots.splice(0)) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("publishes and acknowledges one claimed lifecycle event", async () => {
    const emit = vi.fn();
    const dispatcher = createGoalOutboxDispatcher(client, {
      emit,
      now: () => currentTime,
      randomId: () => "claim-1",
    });

    expect(await dispatcher.drainOnce()).toBe("published");
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      kind: "goal.set.completed",
      eventKey: "run-1/1/goal.set.completed",
      runId: "run-1",
      goalId: "goal-1",
      revision: 1,
    }));
    expect((await client.execute("SELECT status, claim_token FROM run_goal_outbox")).rows[0]).toMatchObject({
      status: "published",
      claim_token: null,
    });
  });

  it("allows only one competing dispatcher to publish a row", async () => {
    const emit = vi.fn();
    const first = createGoalOutboxDispatcher(client, { emit, now: () => currentTime, randomId: () => "claim-a" });
    const second = createGoalOutboxDispatcher(client, { emit, now: () => currentTime, randomId: () => "claim-b" });

    const results = await Promise.all([first.drainOnce(), second.drainOnce()]);
    expect(results.sort()).toEqual(["idle", "published"]);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("retries transient publication failure with bounded backoff", async () => {
    const dispatcher = createGoalOutboxDispatcher(client, {
      emit: () => { throw new Error("ring unavailable"); },
      now: () => currentTime,
      randomId: () => "claim-1",
      maxAttempts: 3,
      onDiagnosticFailure: vi.fn(),
    });

    expect(await dispatcher.drainOnce()).toBe("retryable");
    const row = (await client.execute("SELECT status, attempt_count, next_attempt_at, last_error FROM run_goal_outbox")).rows[0];
    expect(row).toMatchObject({ status: "retryable", attempt_count: 1, last_error: "ring unavailable" });
    expect(Number(row?.next_attempt_at)).toBeGreaterThan(currentTime);
  });

  it("automatically publishes a retry after its backoff without another mutation", async () => {
    vi.useFakeTimers();
    let failNextPublish = true;
    const emit = vi.fn((_event: { kind: string }) => {
      if (failNextPublish) {
        failNextPublish = false;
        throw new Error("ring temporarily unavailable");
      }
    });
    const dispatcher = createGoalOutboxDispatcher(client, {
      emit,
      now: () => currentTime,
      randomId: () => `claim-${emit.mock.calls.length}`,
      maxAttempts: 3,
      onDiagnosticFailure: vi.fn(),
    });

    await dispatcher.startAutoDelivery();
    expect((await client.execute("SELECT status FROM run_goal_outbox")).rows[0]?.status).toBe("retryable");

    currentTime += 1_000;
    await vi.advanceTimersByTimeAsync(1_000);

    expect((await client.execute("SELECT status FROM run_goal_outbox")).rows[0]?.status).toBe("published");
    expect(emit.mock.calls.filter(([event]) => event.kind === "goal.set.completed")).toHaveLength(2);
    dispatcher.stopAutoDelivery();
  });

  it("does not spin an auto-delivery timer when no eligible rows remain", async () => {
    const dispatcher = createGoalOutboxDispatcher(client, { emit: vi.fn() });
    expect(await dispatcher.drainOnce()).toBe("published");
    vi.useFakeTimers();

    await dispatcher.startAutoDelivery();

    expect(vi.getTimerCount()).toBe(0);
    dispatcher.stopAutoDelivery();
  });

  it("poisons a terminal publication failure and surfaces the blocked run", async () => {
    const events: Array<Record<string, unknown>> = [];
    const dispatcher = createGoalOutboxDispatcher(client, {
      emit: (event) => {
        events.push(event);
        if (event.kind !== "error.surfaced") throw new Error("invalid event");
      },
      now: () => currentTime,
      randomId: () => "claim-1",
      maxAttempts: 1,
      onDiagnosticFailure: vi.fn(),
    });

    expect(await dispatcher.drainOnce()).toBe("poisoned");
    expect(events.at(-1)).toMatchObject({
      kind: "error.surfaced",
      code: "goal.outbox.poisoned",
      runId: "run-1",
    });
    expect((await client.execute("SELECT status FROM run_goal_outbox")).rows[0]?.status).toBe("poisoned");
  });

  it("reclaims an expired acknowledgement lease and safely duplicates delivery", async () => {
    const events: Array<Record<string, unknown>> = [];
    const first = createGoalOutboxDispatcher(client, {
      emit: (event) => events.push(event), now: () => currentTime, randomId: () => "claim-a", claimLeaseMs: 500,
    });
    const claim = await first.claimNext();
    expect(claim?.claimToken).toBe("claim-a");
    first.publishClaim(claim!);

    currentTime += 501;
    const second = createGoalOutboxDispatcher(client, {
      emit: (event) => events.push(event), now: () => currentTime, randomId: () => "claim-b", claimLeaseMs: 500,
    });
    expect(await second.drainOnce()).toBe("published");
    expect(events).toHaveLength(2);
    expect(events[0]?.eventKey).toBe(events[1]?.eventKey);
  });

  it("retains active-run idempotency and compacts settled terminal history beyond the checkpoint", async () => {
    await client.execute({
      sql: "UPDATE run_goal_outbox SET status = 'published', published_at = ?, updated_at = ?",
      args: [currentTime - 10_000, currentTime - 10_000],
    });
    await client.execute({
      sql: "UPDATE run_goal_operations SET updated_at = ?",
      args: [currentTime - 10_000],
    });
    const emit = vi.fn();
    expect(await compactGoalControlHistory(client, { now: currentTime, retentionMs: 5_000, emit })).toEqual({
      operationCount: 0,
      outboxCount: 0,
    });

    await client.execute({
      sql: "UPDATE runs SET status = 'done', updated_at = ? WHERE id = 'run-1'",
      args: [currentTime - 10_000],
    });
    expect(await compactGoalControlHistory(client, { now: currentTime, retentionMs: 5_000, emit })).toEqual({
      operationCount: 1,
      outboxCount: 1,
    });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ kind: "goal.history.compacted" }));
  });
});
