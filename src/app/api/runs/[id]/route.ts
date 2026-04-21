import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { cancelAgent } from "@/server/bridge-client";
import { recoverRun } from "@/server/runs/recovery";
import { stopRunObserver } from "@/server/supervisor/observer";
import { cancelSupervisorWake } from "@/server/supervisor/wake";
import { getAppDataPath } from "@/server/app-root";
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
} from "@/server/db/schema";

function normalizeTitle(input: unknown) {
  const title = String(input ?? "").trim().replace(/\s+/g, " ");
  return title;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    const body = await req.json();
    const title = normalizeTitle(body?.title);

    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }

    await db
      .update(runs)
      .set({ title, updatedAt: new Date() })
      .where(eq(runs.id, runId));

    return NextResponse.json({ ok: true, runId, title });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    const body = await req.json();
    const action = body?.action;
    const targetMessageId = String(body?.targetMessageId ?? "");
    const content = typeof body?.content === "string" ? body.content : undefined;

    if (action !== "retry" && action !== "edit" && action !== "fork") {
      return NextResponse.json({ error: "Unsupported recovery action" }, { status: 400 });
    }

    if (!targetMessageId) {
      return NextResponse.json({ error: "targetMessageId is required" }, { status: 400 });
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
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
