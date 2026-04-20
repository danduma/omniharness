import { randomUUID } from "crypto";
import { db } from "../db";
import { clarifications, runs, executionEvents } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { resumeSupervisorRun } from "../supervisor/resume";

export async function pauseForClarifications(runId: string, questions: string[]) {
  const now = new Date();
  for (const question of questions) {
    await db.insert(clarifications).values({
      id: randomUUID(),
      runId,
      question,
      answer: null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: null,
    planItemId: null,
    eventType: "clarifications_requested",
    details: JSON.stringify({ count: questions.length }),
    createdAt: now,
  });

  await db.update(runs).set({ status: "awaiting_user", updatedAt: now }).where(eq(runs.id, runId));
}

export async function resumeRunAfterClarification(runId: string) {
  const pending = await db
    .select()
    .from(clarifications)
    .where(and(eq(clarifications.runId, runId), eq(clarifications.status, "pending")));

  const now = new Date();
  const nextStatus = pending.length > 0 ? "awaiting_user" : "running";

  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: null,
    planItemId: null,
    eventType: "clarification_resolved",
    details: JSON.stringify({ remainingPending: pending.length }),
    createdAt: now,
  });

  if (nextStatus === "running") {
    await resumeSupervisorRun(runId);
  } else {
    await db.update(runs).set({ status: nextStatus, updatedAt: now }).where(eq(runs.id, runId));
  }
  return { nextStatus, pendingCount: pending.length };
}
