import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, runs, workers } from "@/server/db/schema";
import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";

const OBSERVER_INTERVAL_MS = 5_000;
const IDLE_THRESHOLD_MS = 30_000;

interface WorkerBridgeSnapshot {
  state: string;
  currentText: string;
  lastText: string;
  pendingPermissions?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
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

function normalizeSnapshot(snapshot: WorkerBridgeSnapshot | bridge.AgentRecord) {
  const issues: string[] = [];

  if (!Array.isArray(snapshot.stderrBuffer)) {
    issues.push("stderrBuffer was missing or not an array");
  }

  if (typeof snapshot.state !== "string" || !snapshot.state.trim()) {
    issues.push("state was missing or not a string");
  }

  return {
    snapshot: {
      state: typeof snapshot.state === "string" ? snapshot.state : "unknown",
      currentText: typeof snapshot.currentText === "string" ? snapshot.currentText : "",
      lastText: typeof snapshot.lastText === "string" ? snapshot.lastText : "",
      pendingPermissions: snapshot.pendingPermissions ?? [],
      stderrBuffer: Array.isArray(snapshot.stderrBuffer) ? snapshot.stderrBuffer : [],
      stopReason: typeof snapshot.stopReason === "string" ? snapshot.stopReason : null,
    } satisfies WorkerBridgeSnapshot,
    issues,
  };
}

function snapshotFingerprint(snapshot: WorkerBridgeSnapshot) {
  return JSON.stringify({
    state: snapshot.state,
    currentText: snapshot.currentText,
    lastText: snapshot.lastText,
    pendingPermissions: snapshot.pendingPermissions ?? [],
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
  const currentPendingFingerprint = JSON.stringify(args.snapshot.pendingPermissions ?? []);
  let previousPendingFingerprint = "[]";
  if (previous) {
    try {
      const parsed = JSON.parse(previous.fingerprint) as { pendingPermissions?: unknown };
      previousPendingFingerprint = JSON.stringify(parsed.pendingPermissions ?? []);
    } catch {
      previousPendingFingerprint = "[]";
    }
  }
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

  if (
    currentPendingFingerprint !== previousPendingFingerprint &&
    (args.snapshot.pendingPermissions?.length ?? 0) > 0
  ) {
    events.push({
      type: "worker_permission_requested",
      summary: `${args.workerId} is waiting on a permission decision`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
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
      const rawSnapshot = await bridge.getAgent(worker.id);
      const normalized = normalizeSnapshot(rawSnapshot);
      snapshot = normalized.snapshot;

      if (normalized.issues.length > 0) {
        const error = new Error(
          `Invalid worker snapshot for ${worker.id}: ${normalized.issues.join("; ")}`,
        );
        await insertExecutionEvent(runId, worker.id, "worker_snapshot_invalid", {
          summary: error.message,
          issues: normalized.issues,
          snapshot: {
            state: snapshot.state,
            stopReason: snapshot.stopReason,
          },
        });
        stopRunObserver(runId);
        await persistRunFailure(runId, error);
        return;
      }
    } catch (error) {
      await insertExecutionEvent(runId, worker.id, "worker_poll_failed", {
        summary: `Observer polling failed for ${worker.id}`,
        reason: formatErrorMessage(error),
      });
      stopRunObserver(runId);
      await persistRunFailure(runId, error);
      return;
    }

    try {
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
    } catch (error) {
      await insertExecutionEvent(runId, worker.id, "worker_observer_failed", {
        summary: `Observer failed while processing ${worker.id}`,
        reason: formatErrorMessage(error),
      });
      stopRunObserver(runId);
      await persistRunFailure(runId, error);
      return;
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
