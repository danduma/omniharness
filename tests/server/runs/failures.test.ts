import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, runs, workerCounters, workers } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";
import {
  __resetNamedEventsForTests,
  getNamedEventsSince,
  type ErrorSurfacedEvent,
} from "@/server/events/named-events";

describe("persistRunFailure", () => {
  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(executionEvents);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
    __resetNamedEventsForTests();
  });

  async function seedRunningRun() {
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
    return { runId, planId };
  }

  function collectSurfacedEvents(): ErrorSurfacedEvent[] {
    const replay = getNamedEventsSince(0);
    return replay.events
      .map((entry) => entry.event)
      .filter((event): event is ErrorSurfacedEvent => event.kind === "error.surfaced");
  }

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

  it("does not append a duplicate system error message when the same failure is persisted twice", async () => {
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

    await persistRunFailure(runId, new Error("codex ACP adapter is not installed"));
    await persistRunFailure(runId, new Error("codex ACP adapter is not installed"));

    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(persistedMessages).toHaveLength(1);
    expect(persistedMessages[0]?.content).toBe("Run failed: codex ACP adapter is not installed");
  });

  it("does not append duplicate run_failed events when the same failure is persisted twice", async () => {
    const { runId } = await seedRunningRun();

    await persistRunFailure(runId, new Error("provider billing cap exceeded"), {
      surface: { code: "supervisor.gave_up" },
    });
    await persistRunFailure(runId, new Error("provider billing cap exceeded"), {
      surface: { code: "supervisor.gave_up" },
    });

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(persistedRun?.lastError).toBe("provider billing cap exceeded");
    expect(persistedMessages).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("run_failed");
  });

  it("records a durable run_failed execution event for persisted failures", async () => {
    const { runId } = await seedRunningRun();
    await db.insert(workers).values({
      id: "worker-1",
      runId,
      type: "gemini",
      status: "working",
      cwd: "/tmp",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await persistRunFailure(runId, new Error("direct follow-up exploded"), {
      surface: { code: "conversation.continue.failed", workerId: "worker-1" },
    });

    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "run_failed",
      workerId: "worker-1",
    });
    expect(events[0]?.details).toContain("direct follow-up exploded");
  });

  it("does not overwrite a cancelled run with a late failure", async () => {
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
      status: "cancelled",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await persistRunFailure(runId, new Error("late observer failure"));

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(persistedRun?.status).toBe("cancelled");
    expect(persistedRun?.lastError).toBeNull();
    expect(persistedMessages).toHaveLength(0);
  });

  it("emits error.surfaced exactly once when surface option is provided and run transitions to failed", async () => {
    const { runId } = await seedRunningRun();

    await persistRunFailure(runId, new Error("worker exploded"), {
      surface: { code: "worker.poll.failed", workerId: "worker-1" },
    });

    const events = collectSurfacedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "error.surfaced",
      code: "worker.poll.failed",
      message: expect.stringContaining("worker exploded"),
      surface: "toast",
      runId,
      workerId: "worker-1",
    });
    expect(events[0]?.cause).toMatchObject({ message: "worker exploded" });
  });

  it("does not emit error.surfaced when no surface option is provided", async () => {
    const { runId } = await seedRunningRun();
    await persistRunFailure(runId, new Error("silent failure"));
    expect(collectSurfacedEvents()).toHaveLength(0);
  });

  it("does not re-emit error.surfaced when persistRunFailure is called twice on an already-failed run", async () => {
    const { runId } = await seedRunningRun();
    await persistRunFailure(runId, new Error("first failure"), {
      surface: { code: "worker.poll.failed", workerId: "worker-1" },
    });
    await persistRunFailure(runId, new Error("second failure"), {
      surface: { code: "worker.poll.failed", workerId: "worker-1" },
    });

    const events = collectSurfacedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.message).toContain("first failure");
  });

  it("does not emit error.surfaced when the run is already terminal in a non-failed state", async () => {
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
      status: "cancelled",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await persistRunFailure(runId, new Error("late failure"), {
      surface: { code: "worker.poll.failed" },
    });

    expect(collectSurfacedEvents()).toHaveLength(0);
  });
});
