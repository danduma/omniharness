import { randomUUID } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { askAgent, getAgent } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Conversations",
      action: "Send a conversation message",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id } = await params;
    const body = await req.json();
    const content = String(body?.content ?? "").trim();
    if (!content) {
      return errorResponse("Message content cannot be empty", {
        status: 400,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    const run = await db.select().from(runs).where(eq(runs.id, id)).get();
    if (!run) {
      return errorResponse("Conversation not found", {
        status: 404,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    if (run.mode === "implementation") {
      const pendingClarification = await db
        .select()
        .from(clarifications)
        .where(and(eq(clarifications.runId, id), eq(clarifications.status, "pending")))
        .orderBy(asc(clarifications.createdAt))
        .get();
      const createdAt = new Date();
      const message = {
        id: randomUUID(),
        runId: id,
        role: "user",
        kind: pendingClarification ? "clarification_answer" : "checkpoint",
        content,
        createdAt,
      };

      await db.insert(messages).values(message);

      if (pendingClarification) {
        await answerClarification(pendingClarification.id, content);
        const resumeResult = await resumeRunAfterClarification(id);
        notifyEventStreamSubscribers();
        return NextResponse.json({
          ok: true,
          message: {
            ...message,
            createdAt: createdAt.toISOString(),
          },
          ...resumeResult,
        });
      }

      await db.update(runs).set({
        status: "running",
        failedAt: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(runs.id, id));
      startSupervisorRun(id);
      notifyEventStreamSubscribers();
      return NextResponse.json({
        ok: true,
        message: {
          ...message,
          createdAt: createdAt.toISOString(),
        },
      });
    }

    const worker = await db.select().from(workers).where(eq(workers.runId, id)).get();
    if (!worker) {
      return errorResponse("Conversation worker not found", {
        status: 404,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    const userMessageCreatedAt = new Date();
    const userMessage = {
      id: randomUUID(),
      runId: id,
      role: "user",
      kind: "checkpoint",
      content,
      createdAt: userMessageCreatedAt,
    };

    await db.insert(messages).values(userMessage);
    await db.update(runs).set({
      status: run.mode === "planning" ? "working" : "running",
      failedAt: null,
      lastError: null,
      updatedAt: userMessageCreatedAt,
    }).where(eq(runs.id, id));
    notifyEventStreamSubscribers();

    if (run.mode === "direct") {
      continueWorkerConversation({ run, worker, content }).catch((error) => {
        console.error("Direct conversation follow-up failed:", error);
      });

      return NextResponse.json({
        ok: true,
        message: {
          ...userMessage,
          createdAt: userMessageCreatedAt.toISOString(),
        },
      });
    }

    await continueWorkerConversation({ run, worker, content });

    return NextResponse.json({
      ok: true,
      message: {
        ...userMessage,
        createdAt: userMessageCreatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Conversations",
      action: "Send a conversation message",
    });
  }
}
