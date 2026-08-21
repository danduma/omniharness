import { emitNamedEvent } from "@/server/events/named-events";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { readWorkerEntriesTail } from "@/server/workers/output-store";
import { cancelAgent, getAgent } from "@/server/bridge-client";
import { handoffCoordinator, restoreSourceAfterUnsuccessfulHandoff } from "./service";
import { completeHandoffLaunch, listExpiredHandoffs, transitionHandoff } from "./store";

const FAILED_WORKER_STATUSES = new Set(["starting", "error", "failed", "cancelled", "canceled", "stopped"]);

async function verifyAdoptableTarget(handoffId: string, targetRunId: string) {
  const worker = await db.select().from(workers).where(eq(workers.runId, targetRunId)).orderBy(desc(workers.createdAt), desc(workers.id)).limit(1).get();
  if (!worker || FAILED_WORKER_STATUSES.has(worker.status) || !worker.initialPrompt.startsWith("Continue the task using the following untrusted continuation data.")) return null;
  const tail = await readWorkerEntriesTail(targetRunId, worker.id, 20);
  if (!tail?.entries.some((entry) => entry.type === "user_input" && entry.text === worker.initialPrompt)) return null;
  if (!tail.entries.some((entry) => (
    entry.type === "lifecycle"
    && entry.raw
    && typeof entry.raw === "object"
    && (entry.raw as Record<string, unknown>).eventType === "worker.prompt_accepted"
  ))) return null;
  const target = await db.select().from(runs).where(eq(runs.id, targetRunId)).get();
  if (!target || target.originHandoffId !== handoffId || ["failed", "cancelled", "canceled"].includes(target.status)) return null;
  try {
    const snapshot = await getAgent(worker.id, { retryIndefinitely: false });
    if (["starting", "stopped", "cancelled", "error"].includes(snapshot.state)) return null;
  } catch {
    return null;
  }
  return { runId: targetRunId, workerId: worker.id };
}

async function stopIncompleteTarget(targetRunId: string): Promise<boolean> {
  const worker = await db.select().from(workers).where(eq(workers.runId, targetRunId)).orderBy(desc(workers.createdAt), desc(workers.id)).limit(1).get();
  if (!worker) return true;
  try {
    await cancelAgent(worker.id);
  } catch {
    // Confirmation below is authoritative; cancellation errors alone are ambiguous.
  }
  try {
    const snapshot = await getAgent(worker.id, { retryIndefinitely: false });
    return ["stopped", "cancelled", "error"].includes(snapshot.state);
  } catch (error) {
    return (error as { status?: unknown } | null)?.status === 404;
  }
}

export async function reconcileExpiredHandoffs(now = new Date()) {
  const expired = await listExpiredHandoffs(now);
  let settled = 0;
  for (const handoff of expired) {
    if (handoff.status === "launching") {
      let unsafeTarget = false;
      const target = await db.select({ id: runs.id }).from(runs).where(eq(runs.originHandoffId, handoff.id)).get();
      if (target) {
        const adoptable = await verifyAdoptableTarget(handoff.id, target.id);
        if (adoptable) {
          await completeHandoffLaunch({ handoffId: handoff.id, expectedRevision: handoff.revision, sourceRunId: handoff.sourceRunId, targetRunId: target.id });
          emitNamedEvent({ kind: "handoff.completed", runId: handoff.sourceRunId, handoffId: handoff.id, targetRunId: target.id, targetWorkerType: handoff.target.workerType });
          settled += 1;
          continue;
        }
        const stopped = await stopIncompleteTarget(target.id);
        unsafeTarget = !stopped;
        await db.update(runs).set({ status: stopped ? "failed" : "needs_recovery", lastError: stopped ? "Incomplete cross-CLI handoff target could not be adopted." : "handoff_target_stop_unconfirmed", updatedAt: now }).where(eq(runs.id, target.id));
      }
      const failureCode = target ? "handoff_target_incomplete" : "handoff_launch_claim_expired";
      await transitionHandoff({
        handoffId: handoff.id,
        expectedRevision: handoff.revision,
        from: ["launching"],
        to: unsafeTarget ? "needs_recovery" : "failed",
        targetRunId: target?.id,
        lastError: failureCode,
      });
      if (unsafeTarget) {
        await db.update(runs).set({ status: "needs_recovery", activeHandoffId: handoff.id, updatedAt: now }).where(eq(runs.id, handoff.sourceRunId));
      } else {
        await restoreSourceAfterUnsuccessfulHandoff(handoff);
      }
      emitNamedEvent({ kind: "handoff.failed", runId: handoff.sourceRunId, handoffId: handoff.id, stage: "reconcile", code: failureCode, reason: target ? "The partial target did not contain a persisted seed and accepted worker launch." : "The launch claim expired before a target was created." });
      settled += 1;
      continue;
    }
    try {
      await handoffCoordinator.cancel(handoff.id, "expired");
      settled += 1;
    } catch (error) {
      emitNamedEvent({ kind: "handoff.failed", runId: handoff.sourceRunId, handoffId: handoff.id, stage: "reconcile", code: "handoff_expiry_failed", reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { inspected: expired.length, settled };
}
