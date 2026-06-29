import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountUsageSnapshots,
  accounts,
  plans,
  recoveryIncidents,
  runs,
  workerCredentialAllocations,
  workers,
} from "@/server/db/schema";
import { allocateWorkerAccount } from "@/server/accounts/account-allocator";

async function insertAccount(input: Partial<typeof accounts.$inferInsert> & { id?: string; cliType: string; priority?: number }) {
  const now = new Date("2026-06-29T13:00:00.000Z");
  const id = input.id ?? `account-${randomUUID()}`;
  await db.insert(accounts).values({
    id,
    cliType: input.cliType,
    provider: input.provider ?? "openai",
    type: input.type ?? "subscription",
    label: input.label ?? id,
    authMode: input.authMode ?? "local_session",
    authRef: input.authRef ?? "local-default",
    enabled: input.enabled ?? true,
    priority: input.priority ?? 0,
    status: input.status ?? "healthy",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
  return id;
}

async function insertRunAndWorker(workerType = "codex") {
  const now = new Date("2026-06-29T13:05:00.000Z");
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `worker-${randomUUID()}`;
  await db.insert(plans).values({
    id: planId,
    path: "vibes/test-account-allocator.md",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    preferredWorkerType: workerType,
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: workerType,
    status: "idle",
    cwd: process.cwd(),
    createdAt: now,
    updatedAt: now,
  });
  return { runId, workerId };
}

describe("account allocator", () => {
  it("uses explicit account preferences and persists the worker allocation", async () => {
    const workerType = `codex-${randomUUID()}`;
    const accountId = await insertAccount({ cliType: workerType, priority: 1 });
    const { runId, workerId } = await insertRunAndWorker(workerType);

    const allocation = await allocateWorkerAccount({
      workerType,
      explicitAccountId: accountId,
      runId,
      workerId,
      strategy: "priority",
    });

    expect(allocation.account?.id).toBe(accountId);
    expect(allocation.explicit).toBe(true);
    expect(allocation.strategy).toBe("manual");

    const row = await db
      .select()
      .from(workerCredentialAllocations)
      .where(eq(workerCredentialAllocations.workerId, workerId))
      .get();
    expect(row).toMatchObject({
      accountId,
      workerType,
      explicit: true,
      strategy: "manual",
    });
  });

  it("chooses the highest-priority usable account by default", async () => {
    const workerType = `codex-${randomUUID()}`;
    await insertAccount({ cliType: workerType, priority: 1, label: "low-priority" });
    const highPriority = await insertAccount({ cliType: workerType, priority: 10, label: "high-priority" });

    const allocation = await allocateWorkerAccount({ workerType });

    expect(allocation.account?.id).toBe(highPriority);
    expect(allocation.reason).toContain("highest-priority");
  });

  it("balances by the latest remaining quota snapshot", async () => {
    const workerType = `codex-${randomUUID()}`;
    const small = await insertAccount({ cliType: workerType, priority: 10, label: "small-quota" });
    const large = await insertAccount({ cliType: workerType, priority: 1, label: "large-quota" });
    const now = new Date("2026-06-29T13:10:00.000Z");

    await db.insert(accountUsageSnapshots).values([
      {
        id: randomUUID(),
        accountId: small,
        workerType,
        windowKey: "2026-06",
        usedTokens: 90,
        remainingTokens: 10,
        source: "test",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        accountId: large,
        workerType,
        windowKey: "2026-06",
        usedTokens: 10,
        remainingTokens: 90,
        source: "test",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const allocation = await allocateWorkerAccount({ workerType, strategy: "quota_balanced" });

    expect(allocation.account?.id).toBe(large);
  });

  it("skips accounts with active quota incidents during automatic allocation", async () => {
    const workerType = `codex-${randomUUID()}`;
    const blocked = await insertAccount({ cliType: workerType, priority: 10, label: "blocked" });
    const fallback = await insertAccount({ cliType: workerType, priority: 1, label: "fallback" });
    const { runId } = await insertRunAndWorker(workerType);
    await db.insert(recoveryIncidents).values({
      id: randomUUID(),
      runId,
      workerId: null,
      queuedMessageId: null,
      kind: "quota_exhausted",
      status: "open",
      autoAttemptCount: 0,
      lastError: null,
      details: JSON.stringify({
        accountId: blocked,
        resumeAt: new Date("2026-06-29T14:00:00.000Z").toISOString(),
      }),
      detectedAt: new Date("2026-06-29T13:45:00.000Z"),
      updatedAt: new Date("2026-06-29T13:45:00.000Z"),
      resolvedAt: null,
    });

    const allocation = await allocateWorkerAccount({
      workerType,
      strategy: "priority",
      now: new Date("2026-06-29T13:50:00.000Z"),
    });

    expect(allocation.account?.id).toBe(fallback);
  });

  it("falls back to legacy runtime behavior when no account inventory exists", async () => {
    const allocation = await allocateWorkerAccount({ workerType: `missing-${randomUUID()}` });

    expect(allocation.account).toBeNull();
    expect(allocation.reason).toContain("no account inventory");
  });

  it("falls back to legacy runtime behavior when automatic API-key accounts have no configured key", async () => {
    const workerType = `gemini-${randomUUID()}`;
    await insertAccount({
      cliType: workerType,
      provider: "google",
      type: "api",
      authMode: "api_key",
      authRef: "setting:GEMINI_API_KEY",
    });

    const allocation = await allocateWorkerAccount({
      workerType,
      env: {},
      strategy: "priority",
    });

    expect(allocation.account).toBeNull();
    expect(allocation.reason).toContain("no usable automatic account");
  });
});
