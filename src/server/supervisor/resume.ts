import { db } from "../db";
import { runs, workers } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { startSupervisorRun } from "./start";
import { clearSupervisorWakeLease } from "./lease";
import { getAgent } from "@/server/bridge-client";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { isRecoverableAgentMissingError } from "@/server/runs/recovery-state";
import { cancelDurableSupervisorWake } from "./wake-schedule";
import { hasResumableQuotaIncident, resumeDirectRunAfterQuotaReset } from "@/server/quota/worker-resume";

export async function resumeSupervisorRun(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  // Gate on the open incident, not `runs.status` — conversation sync rewrites
  // direct-run status without quota awareness, and gating on `quota_waiting`
  // meant Resume silently skipped the quota path for exactly the runs that
  // needed it most. Cancel the wake only once we know we are taking over.
  const resumesQuotaBlockedWorker = Boolean(
    run
    && run.mode !== "implementation"
    && (run.status === "quota_waiting" || await hasResumableQuotaIncident(runId)),
  );
  await cancelDurableSupervisorWake(runId, "quota_wait");
  if (run && resumesQuotaBlockedWorker) {
    const quotaResumeResult = await resumeDirectRunAfterQuotaReset({ run, source: "manual_resume" });
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
