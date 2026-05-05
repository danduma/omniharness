import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs } from "@/server/db/schema";
import { startSupervisorRun } from "./start";
import { clearSupervisorWakeLease } from "./lease";
import { isTransientSupervisorError } from "./retry";

const WATCHDOG_INTERVAL_MS = 15_000;

let startupPromise: Promise<void> | null = null;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;

function isRecoverableFailedImplementationRun(run: typeof runs.$inferSelect) {
  return run.mode === "implementation"
    && run.status === "failed"
    && Boolean(run.lastError?.trim())
    && isTransientSupervisorError(new Error(run.lastError ?? ""));
}

async function clearMatchingRunFailureMessage(run: typeof runs.$inferSelect) {
  if (!run.lastError) {
    return;
  }

  await db.delete(messages).where(and(
    eq(messages.runId, run.id),
    eq(messages.role, "system"),
    eq(messages.kind, "error"),
    eq(messages.content, `Run failed: ${run.lastError}`),
  ));
}

async function resumeRecoverableFailedImplementationRun(run: typeof runs.$inferSelect) {
  const now = new Date();

  await clearSupervisorWakeLease(run.id);
  await clearMatchingRunFailureMessage(run);
  await db.update(plans).set({
    status: "running",
    updatedAt: now,
  }).where(eq(plans.id, run.planId));
  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: now,
  }).where(eq(runs.id, run.id));
}

export async function syncRunningSupervision() {
  const activeRuns = await db.select().from(runs).where(and(
    inArray(runs.status, ["running", "failed"]),
    eq(runs.mode, "implementation"),
  ));
  for (const run of activeRuns) {
    if (run.status === "failed") {
      if (!isRecoverableFailedImplementationRun(run)) {
        continue;
      }
      await resumeRecoverableFailedImplementationRun(run);
    }

    startSupervisorRun(run.id);
  }
}

export async function ensureSupervisorRuntimeStarted() {
  if (!startupPromise) {
    startupPromise = syncRunningSupervision().then(() => {
      if (!watchdogInterval) {
        watchdogInterval = setInterval(() => {
          void syncRunningSupervision();
        }, WATCHDOG_INTERVAL_MS);
      }
    }).catch((error) => {
      startupPromise = null;
      throw error;
    });
  }

  await startupPromise;
}
