import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { getAgent } from "@/server/bridge-client";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { cancelQuotaWake } from "@/server/quota/wake-schedule";
import { hasResumableQuotaIncident, resumeDirectRunAfterQuotaReset } from "@/server/quota/worker-resume";

/**
 * The user pressed Resume on a stalled conversation.
 *
 * A quota-blocked worker is resumed straight away rather than waiting for the
 * reset timer. Anything else goes through forced recovery, which resumes the
 * saved session or replaces the worker.
 *
 * The quota path is gated on the open incident, not `runs.status`: conversation
 * sync rewrites run status without knowing about quota, so a parked run can read
 * `running` while its worker is still blocked.
 */
export async function resumeRunManually(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw Object.assign(new Error("Run not found"), { status: 404 });
  }

  const resumesQuotaBlockedWorker = run.status === "quota_waiting" || await hasResumableQuotaIncident(runId);
  await cancelQuotaWake(runId, "quota_wait");
  if (resumesQuotaBlockedWorker) {
    const quotaResumeResult = await resumeDirectRunAfterQuotaReset({ run, source: "manual_resume" });
    return { action: "resume_direct_quota" as const, runId, recovery: quotaResumeResult };
  }

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const liveAgents = (await Promise.all(runWorkers.map(async (worker) => {
    try {
      return await getAgent(worker.id);
    } catch {
      return null;
    }
  }))).filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));

  return reconcileRunRecovery({
    runId,
    liveAgents,
    force: true,
    source: "manual-resume",
  });
}
