import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";

describe("persistRunFailure", () => {
  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("persists nested error causes instead of dropping them to a generic wrapper message", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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

    const networkError = Object.assign(new Error("connect ECONNREFUSED api.example.com:443"), {
      code: "ECONNREFUSED",
    });
    const error = new TypeError("fetch failed", { cause: networkError });

    await persistRunFailure(runId, error);

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedMessage = await db.select().from(messages).where(eq(messages.runId, runId)).get();

    expect(persistedRun?.lastError).toContain("fetch failed");
    expect(persistedRun?.lastError).toContain("connect ECONNREFUSED api.example.com:443");
    expect(persistedMessage?.content).toContain("fetch failed");
    expect(persistedMessage?.content).toContain("connect ECONNREFUSED api.example.com:443");
  });
});
