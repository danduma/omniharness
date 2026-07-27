import { db } from "../db";
import { runs, workers } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { startSupervisorRun } from "./start";
import { clearSupervisorWakeLease } from "./lease";
import { getAgent } from "@/server/bridge-client";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { isRecoverableAgentMissingError } from "@/server/runs/recovery-state";
import { cancelDurableSupervisorWake } from "./wake-schedule";
import { resumeQuotaExhaustedWorkers } from "@/server/quota/worker-resume";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";

export async function resumeSupervisorRun(runId: string) {
  await cancelDurableSupervisorWake(runId, "quota_wait");
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (run?.mode !== "implementation" && run?.status === "quota_waiting") {
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));
    const quotaResumeResult = await resumeQuotaExhaustedWorkers({ run });
    if (quotaResumeResult.state === "none" && quotaResumeResult.resumedCount === 0) {
      const reason = "Quota reset resume was requested, but no resumable worker session was available.";
      await db.update(runs).set({
        status: "needs_recovery",
        lastError: reason,
        updatedAt: new Date(),
      }).where(eq(runs.id, runId));
      await recordExecutionEvent({
        runId,
        eventType: "quota_resume_missing_session",
        details: { summary: reason, reason: "manual_resume" },
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "recovery.needs_user",
        message: reason,
        surface: "banner",
        runId,
      });
    }
    return { action: "resume_direct_quota", runId, recovery: quotaResumeResult };
  }

  if (
    run?.mode === "implementation"
    && run.status === "failed"
    && isRecoverableAgentMissingError(run.lastError)
  ) {
    const latestResumableWorker = await db.select().from(workers)
      .where(eq(workers.runId, runId))
      .orderBy(desc(workers.updatedAt), desc(workers.createdAt), desc(workers.id))
      .then((rows) => rows.find((worker) => worker.bridgeSessionId?.trim()));
    if (latestResumableWorker) {
      await db.update(workers).set({
        status: "working",
        updatedAt: new Date(Date.now() - 60_000),
      }).where(eq(workers.id, latestResumableWorker.id));
    }
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));
  }
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const liveAgents = (await Promise.all(runWorkers.map(async (worker) => {
    try {
      return await getAgent(worker.id);
    } catch {
      return null;
    }
  }))).filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));

  const recoveryResult = await reconcileRunRecovery({
    runId,
    liveAgents,
    force: true,
    source: "manual-resume",
  });
  if (
    recoveryResult.action !== "none"
    && recoveryResult.action !== "wait_for_backoff"
    && recoveryResult.action !== "wait_for_quota_reset"
  ) {
    return recoveryResult;
  }

  await clearSupervisorWakeLease(runId);
  await db.update(runs).set({ status: "running", updatedAt: new Date() }).where(eq(runs.id, runId));
  startSupervisorRun(runId);
  return { action: "resume_supervisor", runId };
}
