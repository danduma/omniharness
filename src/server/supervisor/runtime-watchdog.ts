import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { startSupervisorRun } from "./start";

const WATCHDOG_INTERVAL_MS = 15_000;

let startupPromise: Promise<void> | null = null;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;

export async function syncRunningSupervision() {
  const activeRuns = await db.select().from(runs).where(and(
    eq(runs.status, "running"),
    eq(runs.mode, "implementation"),
  ));
  for (const run of activeRuns) {
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
