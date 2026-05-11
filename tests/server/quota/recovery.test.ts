import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  plans,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  supervisorScheduledWakes,
  workers,
} from "@/server/db/schema";
import {
  handleSupervisorQuotaExhaustion,
  handleWorkerQuotaExhaustion,
} from "@/server/quota/recovery";
import { resetDurableSupervisorWakeSchedulerForTests } from "@/server/supervisor/wake-schedule";

const now = new Date("2026-05-10T10:00:00.000Z");

async function insertRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: "vibes/ad-hoc/quota-recovery.md",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  return runId;
}

async function insertWorker(runId: string) {
  const workerId = `${runId}-worker-1`;
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "codex",
    status: "working",
    cwd: "/tmp",
    workerNumber: 1,
    title: "Worker",
    initialPrompt: "Work",
    outputLog: "",
    outputEntriesJson: "",
    currentText: "",
    lastText: "",
    bridgeSessionId: "session-1",
    bridgeSessionMode: "full-access",
    createdAt: now,
    updatedAt: now,
  });
  return workerId;
}

describe("quota recovery handlers", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    resetDurableSupervisorWakeSchedulerForTests();
    await db.delete(supervisorScheduledWakes);
    await db.delete(recoveryIncidents);
    await db.delete(executionEvents);
    await db.delete(queuedConversationMessages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("persists a schedulable supervisor quota wait without failing the run", async () => {
    const runId = await insertRun();

    const result = await handleSupervisorQuotaExhaustion({
      runId,
      error: Object.assign(new Error("quota exceeded until 2026-05-10T18:00:00+08:00"), { status: 429 }),
      now,
    });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    const wake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();

    expect(result.state).toBe("quota_wait");
    expect(run?.status).toBe("quota_waiting");
    expect(run?.lastError).toBeNull();
    expect(incident).toMatchObject({ kind: "quota_exhausted", status: "open" });
    expect(wake?.wakeAt.toISOString()).toBe("2026-05-10T10:00:01.000Z");
    expect(wake?.incidentId).toBe(incident?.id);
  });

  it("marks worker quota as cred-exhausted and preserves queued messages and sessions", async () => {
    const runId = await insertRun();
    const workerId = await insertWorker(runId);
    const queuedMessageId = randomUUID();
    await db.insert(queuedConversationMessages).values({
      id: queuedMessageId,
      runId,
      targetWorkerId: workerId,
      action: "continue",
      content: "follow up",
      attachmentsJson: null,
      status: "queued",
      lastError: null,
      createdAt: now,
      updatedAt: now,
      deliveredAt: null,
    });

    const result = await handleWorkerQuotaExhaustion({
      runId,
      workerId,
      text: "try again in 30 minutes; quota exhausted",
      now,
    });

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queuedMessageId)).get();
    const wake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();

    expect(result.state).toBe("quota_wait");
    expect(worker?.status).toBe("cred-exhausted");
    expect(worker?.bridgeSessionId).toBe("session-1");
    expect(queued?.status).toBe("queued");
    expect(wake?.wakeAt.getTime()).toBe(now.getTime() + 30 * 60_000 + 1_000);
  });

  it("moves quota without a parseable reset to needs_recovery instead of looping", async () => {
    const runId = await insertRun();

    const result = await handleSupervisorQuotaExhaustion({
      runId,
      error: new Error("quota exceeded for the account"),
      now,
    });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    const wake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();

    expect(result.state).toBe("needs_recovery");
    expect(run?.status).toBe("needs_recovery");
    expect(incident).toMatchObject({ kind: "quota_exhausted", status: "needs_user" });
    expect(wake).toBeUndefined();
  });
});
