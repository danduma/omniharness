import { randomUUID } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { askAgent, getAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { clarifications, messages, runs, workers } from "@/server/db/schema";
import { answerClarification } from "@/server/clarifications/store";
import { resumeRunAfterClarification } from "@/server/clarifications/loop";
import { startSupervisorRun } from "@/server/supervisor/start";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { persistRunFailure } from "@/server/runs/failures";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";

type RunRecord = typeof runs.$inferSelect;
type WorkerRecord = typeof workers.$inferSelect;

async function continueWorkerConversation({
  run,
  worker,
  content,
}: {
  run: RunRecord;
  worker: WorkerRecord;
  content: string;
}) {
  try {
    await db.update(workers).set({
      status: "working",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    notifyEventStreamSubscribers();

    const response = await askAgent(worker.id, content);
    const snapshot = await getAgent(worker.id).catch(() => null);
    if (snapshot) {
      await persistWorkerSnapshot(worker.id, snapshot);
    }

    await db.update(workers).set({
      status: snapshot?.state ?? response.state,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));

    const workerMessageCreatedAt = new Date();
    await db.insert(messages).values({
      id: randomUUID(),
      runId: run.id,
      role: "worker",
      kind: run.mode,
      content: response.response,
      workerId: worker.id,
      createdAt: workerMessageCreatedAt,
    });

    if (run.mode === "planning") {
      const latestRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
      const latestWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
      if (latestRun) {
        await refreshPlanningArtifactsForRun({
          run: latestRun,
          worker: latestWorker,
          snapshot,
          responseText: response.response,
        });
      }
    }

    notifyEventStreamSubscribers();
  } catch (error) {
    await db.update(workers).set({
      status: "error",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    await persistRunFailure(run.id, error);
    throw error;
  }
}

export async function sendConversationMessage({
  runId,
  content,
}: {
  runId: string;
  content: string;
}) {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw Object.assign(new Error("Message content cannot be empty"), { status: 400 });
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }

  if (run.mode === "implementation") {
    const pendingClarification = await db
      .select()
      .from(clarifications)
      .where(and(eq(clarifications.runId, runId), eq(clarifications.status, "pending")))
      .orderBy(asc(clarifications.createdAt))
      .get();
    const createdAt = new Date();
    const message = {
      id: randomUUID(),
      runId,
      role: "user",
      kind: pendingClarification ? "clarification_answer" : "checkpoint",
      content: trimmedContent,
      createdAt,
    };

    await db.insert(messages).values(message);

    if (pendingClarification) {
      await answerClarification(pendingClarification.id, trimmedContent);
      const resumeResult = await resumeRunAfterClarification(runId);
      notifyEventStreamSubscribers();
      return {
        ok: true,
        message: {
          ...message,
          createdAt: createdAt.toISOString(),
        },
        ...resumeResult,
      };
    }

    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));
    startSupervisorRun(runId);
    notifyEventStreamSubscribers();
    return {
      ok: true,
      message: {
        ...message,
        createdAt: createdAt.toISOString(),
      },
    };
  }

  const worker = await db.select().from(workers).where(eq(workers.runId, runId)).get();
  if (!worker) {
    throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
  }

  const userMessageCreatedAt = new Date();
  const userMessage = {
    id: randomUUID(),
    runId,
    role: "user",
    kind: "checkpoint",
    content: trimmedContent,
    createdAt: userMessageCreatedAt,
  };

  await db.insert(messages).values(userMessage);
  await db.update(runs).set({
    status: run.mode === "planning" ? "working" : "running",
    failedAt: null,
    lastError: null,
    updatedAt: userMessageCreatedAt,
  }).where(eq(runs.id, runId));
  notifyEventStreamSubscribers();

  if (run.mode === "direct") {
    continueWorkerConversation({ run, worker, content: trimmedContent }).catch((error) => {
      console.error("Direct conversation follow-up failed:", error);
    });

    return {
      ok: true,
      message: {
        ...userMessage,
        createdAt: userMessageCreatedAt.toISOString(),
      },
    };
  }

  await continueWorkerConversation({ run, worker, content: trimmedContent });

  return {
    ok: true,
    message: {
      ...userMessage,
      createdAt: userMessageCreatedAt.toISOString(),
    },
  };
}
