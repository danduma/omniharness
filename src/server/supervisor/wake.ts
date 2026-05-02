import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";
import { isActiveImplementationRun } from "@/server/runs/status";
import { Supervisor } from "@/server/supervisor";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { stopRunObserver } from "./observer";
import { acquireSupervisorWakeLease, releaseSupervisorWakeLease } from "./lease";

const wakeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const wakeDeadlines = new Map<string, number>();
const inFlight = new Set<string>();

function clearWake(runId: string) {
  const existing = wakeTimers.get(runId);
  if (existing) {
    clearTimeout(existing);
    wakeTimers.delete(runId);
  }
  wakeDeadlines.delete(runId);
}

export async function executeSupervisorWake(runId: string) {
  clearWake(runId);
  if (inFlight.has(runId)) {
    return;
  }

  const leaseId = await acquireSupervisorWakeLease(runId);
  if (!leaseId) {
    return;
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!isActiveImplementationRun(run)) {
    stopRunObserver(runId);
    await releaseSupervisorWakeLease(runId, leaseId);
    return;
  }

  inFlight.add(runId);
  try {
    const supervisor = new Supervisor({ runId });
    const result = await supervisor.run();
    const latestRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!isActiveImplementationRun(latestRun)) {
      clearWake(runId);
      stopRunObserver(runId);
    } else if (result.state === "wait") {
      scheduleSupervisorWake(runId, result.delayMs);
    } else if (result.state === "completed" || result.state === "failed" || result.state === "paused") {
      clearWake(runId);
      if (result.state === "completed" || result.state === "failed") {
        stopRunObserver(runId);
      }
    }
  } catch (error) {
    if (isTransientSupervisorError(error)) {
      scheduleSupervisorWake(runId, 5_000);
      return;
    }
    stopRunObserver(runId);
    await persistRunFailure(runId, error);
  } finally {
    inFlight.delete(runId);
    await releaseSupervisorWakeLease(runId, leaseId);
  }
}

export function scheduleSupervisorWake(runId: string, delayMs = 0) {
  const nextDeadline = Date.now() + Math.max(0, delayMs);
  const currentDeadline = wakeDeadlines.get(runId);
  if (currentDeadline !== undefined && currentDeadline <= nextDeadline) {
    return;
  }

  clearWake(runId);
  wakeDeadlines.set(runId, nextDeadline);
  wakeTimers.set(runId, setTimeout(() => {
    void executeSupervisorWake(runId);
  }, Math.max(0, delayMs)));
}

export function cancelSupervisorWake(runId: string) {
  clearWake(runId);
  inFlight.delete(runId);
}
