import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, runs, workers } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";

const OBSERVER_INTERVAL_MS = 5_000;
const IDLE_THRESHOLD_MS = 30_000;

interface WorkerBridgeSnapshot {
  state: string;
  currentText: string;
  lastText: string;
  stderrBuffer: string[];
  stopReason: string | null;
}

interface WorkerObserverState {
  fingerprint: string;
  lastChangedAt: number;
  idleNotified: boolean;
}

export interface DerivedWorkerEvent {
  type: string;
  summary: string;
  shouldWakeSupervisor: boolean;
  updatesActivity: boolean;
}

const observerIntervals = new Map<string, ReturnType<typeof setInterval>>();
const observerState = new Map<string, WorkerObserverState>();
const FATAL_STDERR_PATTERNS = [
  /ACP write error:/i,
  /\bEPIPE\b/i,
  /\bECONNRESET\b/i,
  /\bERR_STREAM_DESTROYED\b/i,
];

function stateKey(runId: string, workerId: string) {
  return `${runId}:${workerId}`;
}

function snapshotFingerprint(snapshot: WorkerBridgeSnapshot) {
  return JSON.stringify({
    state: snapshot.state,
    currentText: snapshot.currentText,
    lastText: snapshot.lastText,
    stopReason: snapshot.stopReason,
    stderrTail: snapshot.stderrBuffer.slice(-10),
  });
}

function getFatalBridgeStderr(stderrBuffer: string[]) {
  const fatalLine = [...stderrBuffer]
    .reverse()
    .find((line) => FATAL_STDERR_PATTERNS.some((pattern) => pattern.test(line)));

  return fatalLine?.trim() || null;
}

export function deriveWorkerEvents(args: {
  workerId: string;
  snapshot: WorkerBridgeSnapshot;
  previous: WorkerObserverState | undefined;
  now: number;
}): { nextState: WorkerObserverState; events: DerivedWorkerEvent[] } {
  const fingerprint = snapshotFingerprint(args.snapshot);
  const previous = args.previous;
  const changed = !previous || previous.fingerprint !== fingerprint;
  const lastChangedAt = changed ? args.now : previous.lastChangedAt;
  const silenceMs = Math.max(0, args.now - lastChangedAt);
  const events: DerivedWorkerEvent[] = [];
  let idleNotified = previous?.idleNotified ?? false;

  if (changed) {
    events.push({
      type: "worker_output_changed",
      summary: `${args.workerId} output changed`,
      shouldWakeSupervisor: false,
      updatesActivity: true,
    });
    idleNotified = false;
  }

  if (!idleNotified && silenceMs >= IDLE_THRESHOLD_MS) {
    events.push({
      type: "worker_idle",
      summary: `${args.workerId} has been idle for ${Math.round(silenceMs / 1000)} seconds`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
    idleNotified = true;
  }

  if (args.snapshot.state === "error") {
    events.push({
      type: "worker_error",
      summary: `${args.workerId} reported an error state`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
  }

  if (args.snapshot.stopReason || args.snapshot.state === "stopped") {
    events.push({
      type: "worker_stopped",
      summary: `${args.workerId} stopped${args.snapshot.stopReason ? `: ${args.snapshot.stopReason}` : ""}`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
  }

  return {
    nextState: {
      fingerprint,
      lastChangedAt,
      idleNotified,
    },
    events,
  };
}

async function insertExecutionEvent(
  runId: string,
  workerId: string,
  eventType: string,
  details: Record<string, unknown>,
) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId,
    planItemId: null,
    eventType,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
}

export async function pollRunWorkers(runId: string, wakeSupervisor: (runId: string, delayMs?: number) => void) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run || run.status === "done" || run.status === "failed") {
    stopRunObserver(runId);
    return;
  }

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const now = Date.now();

  for (const worker of runWorkers) {
    if (worker.status === "cancelled") {
      continue;
    }

    let snapshot: WorkerBridgeSnapshot;
    try {
      snapshot = await bridge.getAgent(worker.id) as WorkerBridgeSnapshot;
    } catch (error) {
      stopRunObserver(runId);
      await persistRunFailure(runId, error);
      return;
    }

    const key = stateKey(runId, worker.id);
    const previous = observerState.get(key);
    const { nextState, events } = deriveWorkerEvents({
      workerId: worker.id,
      snapshot,
      previous,
      now,
    });

    observerState.set(key, nextState);

    const fatalBridgeError = getFatalBridgeStderr(snapshot.stderrBuffer);
    if (fatalBridgeError) {
      stopRunObserver(runId);
      await persistRunFailure(runId, new Error(fatalBridgeError));
      return;
    }

    const activityEvent = events.find((event) => event.updatesActivity);
    await db.update(workers).set({
      status: snapshot.state,
      updatedAt: activityEvent ? new Date(now) : worker.updatedAt,
    }).where(eq(workers.id, worker.id));

    for (const event of events) {
      await insertExecutionEvent(runId, worker.id, event.type, {
        summary: event.summary,
        state: snapshot.state,
        stopReason: snapshot.stopReason,
        currentText: snapshot.currentText.slice(-1000),
        lastText: snapshot.lastText.slice(-1000),
      });
      if (event.shouldWakeSupervisor && run.status !== "awaiting_user") {
        wakeSupervisor(runId, 0);
      }
    }
  }
}

export function startRunObserver(runId: string, wakeSupervisor: (runId: string, delayMs?: number) => void) {
  if (observerIntervals.has(runId)) {
    return;
  }

  const interval = setInterval(() => {
    void pollRunWorkers(runId, wakeSupervisor);
  }, OBSERVER_INTERVAL_MS);

  observerIntervals.set(runId, interval);
  void pollRunWorkers(runId, wakeSupervisor);
}

export function stopRunObserver(runId: string) {
  const interval = observerIntervals.get(runId);
  if (interval) {
    clearInterval(interval);
    observerIntervals.delete(runId);
  }

  for (const key of observerState.keys()) {
    if (key.startsWith(`${runId}:`)) {
      observerState.delete(key);
    }
  }
}

export async function latestRunWorkerEvents(runId: string) {
  return db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).orderBy(desc(executionEvents.createdAt));
}
