import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { accounts, plans, runs, workers } from "@/server/db/schema";
import { CreditManager } from "@/server/credits";

describe("CreditManager", () => {
  it("reports an exhausted account when capacity reaches zero", async () => {
    const accountId = `test-account-${randomUUID()}`;

    await db.insert(accounts).values({
      id: accountId,
      provider: "anthropic",
      type: "subscription",
      authRef: "TOKEN",
      capacity: 0,
      resetSchedule: "0 0 * * *",
      createdAt: new Date(),
    });

    const manager = new CreditManager();
    const result = await manager.checkCredits(accountId);

    expect(result).toContain("exhausted");
  });

  it("chooses a fallback account when applying the fallback_api strategy", async () => {
    const manager = new CreditManager();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `worker-${randomUUID()}`;

    await db.insert(plans).values({
      id: planId,
      path: "vibes/test-plan.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: process.cwd(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await manager.syncAccounts();

    const result = await manager.applyStrategy(workerId, "fallback_api");

    expect(result).toContain("claude-api-1");
    expect(result).toContain("fallback_api");
  });
});
