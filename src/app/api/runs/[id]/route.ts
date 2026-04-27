import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { cancelAgent } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { recoverRun } from "@/server/runs/recovery";
import { stopRunObserver } from "@/server/supervisor/observer";
import { cancelSupervisorWake } from "@/server/supervisor/wake";
import { getAppDataPath } from "@/server/app-root";
import { requireApiSession } from "@/server/auth/guards";
import {
  plans,
  runs,
  messages,
  workers,
  clarifications,
  planItems,
  validationRuns,
  executionEvents,
  creditEvents,
  workerCounters,
} from "@/server/db/schema";

function normalizeTitle(input: unknown) {
  const title = String(input ?? "").trim().replace(/\s+/g, " ");
  return title;
}

function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function isActiveWorkerStatus(status: string | null | undefined) {
  return ["starting", "working", "idle", "stuck"].includes(normalizeWorkerStatus(status));
}

async function insertExecutionEvent(
  runId: string,
  eventType: string,
  details: Record<string, unknown>,
  workerId?: string | null,
) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: workerId ?? null,
    planItemId: null,
    eventType,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
}

async function cancelWorker(worker: typeof workers.$inferSelect) {
  try {
    await cancelAgent(worker.id);
  } catch {
    // best effort: the bridge process may already be gone
  }

  await db.update(workers).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(eq(workers.id, worker.id));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Runs",
      action: "Rename conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    const body = await req.json();
    const title = normalizeTitle(body?.title);

    if (!title) {
      return errorResponse("Title cannot be empty", {
        status: 400,
        source: "Runs",
        action: "Rename conversation",
      });
    }

    await db
      .update(runs)
      .set({ title, updatedAt: new Date() })
      .where(eq(runs.id, runId));

    return NextResponse.json({ ok: true, runId, title });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Runs",
      action: "Rename conversation",
    });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Runs",
      action: "Recover conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    const body = await req.json();
    const action = body?.action;
    if (action === "stop_supervisor") {
      const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
      if (!run) {
        return errorResponse("Run not found", {
          status: 404,
          source: "Runs",
          action: "Stop supervisor",
        });
      }

      cancelSupervisorWake(runId);
      stopRunObserver(runId);

      const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
      const activeWorkers = runWorkers.filter((worker) => isActiveWorkerStatus(worker.status));
      for (const worker of activeWorkers) {
        await cancelWorker(worker);
      }

      await db.update(runs).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(runs.id, runId));
      await insertExecutionEvent(runId, "supervisor_stopped", {
        summary: "Stopped supervisor and cancelled active workers.",
        cancelledWorkerIds: activeWorkers.map((worker) => worker.id),
      });

      return NextResponse.json({ ok: true, runId });
    }

    if (action === "stop_worker") {
      const workerId = String(body?.workerId ?? "").trim();
      if (!workerId) {
        return errorResponse("workerId is required", {
          status: 400,
          source: "Runs",
          action: "Stop worker",
        });
      }

      const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
      if (!worker || worker.runId !== runId) {
        return errorResponse("Worker not found", {
          status: 404,
          source: "Runs",
          action: "Stop worker",
        });
      }

      await cancelWorker(worker);
      await insertExecutionEvent(runId, "worker_cancelled", {
        summary: `Stopped ${workerId}`,
        reason: "User stopped this worker.",
      }, workerId);

      return NextResponse.json({ ok: true, runId, workerId });
    }

    const targetMessageId = String(body?.targetMessageId ?? "");
    const content = typeof body?.content === "string" ? body.content : undefined;

    if (action !== "retry" && action !== "edit" && action !== "fork") {
      return errorResponse("Unsupported recovery action", {
        status: 400,
        source: "Runs",
        action: "Recover conversation",
      });
    }

    if (!targetMessageId) {
      return errorResponse("targetMessageId is required", {
        status: 400,
        source: "Runs",
        action: "Recover conversation",
      });
    }

    const result = await recoverRun({
      runId,
      action,
      targetMessageId,
      content,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = errorMessage.includes("must be a user message") || errorMessage.includes("required")
      ? 400
      : errorMessage.includes("not found")
        ? 404
        : 500;
    return errorResponse(error, {
      status,
      source: "Runs",
      action: "Recover conversation",
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Runs",
      action: "Delete conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      return errorResponse("Run not found", {
        status: 404,
        source: "Runs",
        action: "Delete conversation",
      });
    }

    cancelSupervisorWake(runId);
    stopRunObserver(runId);

    const plan = await db.select().from(plans).where(eq(plans.id, run.planId)).get();
    const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const workerIds = runWorkers.map((worker) => worker.id);
    const planRows = await db.select().from(planItems).where(eq(planItems.planId, run.planId));
    const planItemIds = planRows.map((item) => item.id);

    for (const worker of runWorkers) {
      try {
        await cancelAgent(worker.id);
      } catch {
        // best-effort: still remove persisted records even if bridge process is already gone
      }
    }

    if (workerIds.length > 0) {
      for (const workerId of workerIds) {
        await db.delete(creditEvents).where(eq(creditEvents.workerId, workerId));
      }
    }

    await db.delete(messages).where(eq(messages.runId, runId));
    await db.delete(clarifications).where(eq(clarifications.runId, runId));
    await db.delete(validationRuns).where(eq(validationRuns.runId, runId));
    await db.delete(executionEvents).where(eq(executionEvents.runId, runId));
    await db.delete(workers).where(eq(workers.runId, runId));
    await db.delete(workerCounters).where(eq(workerCounters.runId, runId));
    await db.delete(runs).where(eq(runs.id, runId));

    for (const planItemId of planItemIds) {
      await db.delete(validationRuns).where(eq(validationRuns.planItemId, planItemId));
      await db.delete(executionEvents).where(eq(executionEvents.planItemId, planItemId));
    }

    await db.delete(planItems).where(eq(planItems.planId, run.planId));
    await db.delete(plans).where(eq(plans.id, run.planId));

    if (plan?.path.startsWith("vibes/ad-hoc/")) {
      const absolutePlanPath = getAppDataPath(plan.path);
      if (fs.existsSync(absolutePlanPath)) {
        fs.rmSync(absolutePlanPath);
      }
    }

    return NextResponse.json({ ok: true, runId });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Runs",
      action: "Delete conversation",
    });
  }
}
