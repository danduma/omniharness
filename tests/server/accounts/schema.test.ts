import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountSecrets,
  accountUsageSnapshots,
  accounts,
  plans,
  runs,
  workerCredentialAllocations,
  workers,
  workerTokenUsage,
} from "@/server/db/schema";
import { toAccountDto } from "@/server/accounts/dto";

describe("account inventory schema", () => {
  it("persists account inventory rows without exposing credential references through DTOs", async () => {
    const accountId = `account-${randomUUID()}`;
    const now = new Date("2026-06-29T12:00:00.000Z");

    await db.insert(accounts).values({
      id: accountId,
      cliType: "codex",
      provider: "openai",
      type: "subscription",
      label: "Work Codex",
      authMode: "isolated_cli_home",
      authRef: "cli-home:work-codex",
      enabled: true,
      priority: 3,
      capacity: 42,
      resetSchedule: "daily",
      status: "healthy",
      statusCheckedAt: now,
      metadataJson: JSON.stringify({ emailHash: "hash-only" }),
      createdAt: now,
      updatedAt: now,
    });

    const row = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();

    expect(row).toMatchObject({
      id: accountId,
      cliType: "codex",
      label: "Work Codex",
      authMode: "isolated_cli_home",
      authRef: "cli-home:work-codex",
      enabled: true,
      priority: 3,
      status: "healthy",
    });

    const dto = toAccountDto(row!);
    expect(dto).toMatchObject({
      id: accountId,
      cliType: "codex",
      label: "Work Codex",
      authMode: "isolated_cli_home",
      enabled: true,
      priority: 3,
      status: "healthy",
      metadata: { emailHash: "hash-only" },
    });
    expect(JSON.stringify(dto)).not.toContain("cli-home:work-codex");
    expect(dto).not.toHaveProperty("authRef");
    expect(dto).not.toHaveProperty("metadataJson");
  });

  it("persists run account preference, secrets, allocations, usage rows, and usage snapshots", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `worker-${randomUUID()}`;
    const accountId = `account-${randomUUID()}`;
    const now = new Date("2026-06-29T12:30:00.000Z");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/test-account-inventory.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(accounts).values({
      id: accountId,
      cliType: "claude",
      provider: "anthropic",
      type: "api",
      label: "Claude API",
      authMode: "api_key",
      authRef: `setting:ACCOUNT_SECRET_${accountId}`,
      enabled: true,
      priority: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      preferredWorkerType: "claude",
      preferredWorkerAccountId: accountId,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(accountSecrets).values({
      id: randomUUID(),
      accountId,
      secretKind: "api_key",
      secretRef: `setting:ACCOUNT_SECRET_${accountId}`,
      encryptedValue: "enc:v1:redacted",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workerCredentialAllocations).values({
      id: randomUUID(),
      runId,
      workerId,
      workerType: "claude",
      accountId,
      strategy: "manual",
      selectionReason: "explicit run preference",
      explicit: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workerTokenUsage).values({
      id: randomUUID(),
      runId,
      workerId,
      workerType: "claude",
      accountId,
      model: "claude-sonnet",
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
      costUsd: 0.0123,
      occurredAt: now,
      createdAt: now,
    });
    await db.insert(accountUsageSnapshots).values({
      id: randomUUID(),
      accountId,
      workerType: "claude",
      windowKey: "2026-06",
      usedTokens: 30,
      remainingTokens: 70,
      costUsd: 0.0123,
      resetAt: new Date("2026-07-01T00:00:00.000Z"),
      source: "local_rollup",
      createdAt: now,
      updatedAt: now,
    });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const allocation = await db.select().from(workerCredentialAllocations).where(eq(workerCredentialAllocations.workerId, workerId)).get();
    const usage = await db.select().from(workerTokenUsage).where(eq(workerTokenUsage.workerId, workerId)).get();
    const snapshot = await db.select().from(accountUsageSnapshots).where(eq(accountUsageSnapshots.accountId, accountId)).get();

    expect(run?.preferredWorkerAccountId).toBe(accountId);
    expect(allocation).toMatchObject({ accountId, explicit: true, strategy: "manual" });
    expect(usage).toMatchObject({ accountId, inputTokens: 10, outputTokens: 20, costUsd: 0.0123 });
    expect(snapshot).toMatchObject({ accountId, usedTokens: 30, remainingTokens: 70, source: "local_rollup" });
  });
});
