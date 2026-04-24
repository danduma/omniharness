import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";
import { Supervisor } from "@/server/supervisor";
import { stopRunObserver } from "./observer";

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

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run || run.mode !== "implementation" || run.status === "done" || run.status === "failed") {
    stopRunObserver(runId);
    return;
  }

  inFlight.add(runId);
  try {
    const supervisor = new Supervisor({ runId });
    const result = await supervisor.run();
    if (result.state === "wait") {
      scheduleSupervisorWake(runId, result.delayMs);
    } else if (result.state === "completed" || result.state === "failed" || result.state === "paused") {
      clearWake(runId);
      if (result.state === "completed" || result.state === "failed") {
        stopRunObserver(runId);
      }
    }
  } catch (error) {
    stopRunObserver(runId);
    await persistRunFailure(runId, error);
  } finally {
    inFlight.delete(runId);
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
