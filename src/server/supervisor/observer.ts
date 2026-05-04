import { and, desc, eq, gt } from "drizzle-orm";
import { randomUUID } from "crypto";
import path from "path";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, runs, workers } from "@/server/db/schema";
import { shouldAutoApprove } from "@/server/permissions";
import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
import { isActiveImplementationRun } from "@/server/runs/status";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

const OBSERVER_INTERVAL_MS = 5_000;
const IDLE_THRESHOLD_MS = 30_000;
const STUCK_THRESHOLD_MS = 90_000;
const DUPLICATE_WORKER_EVENT_WINDOW_MS = 5 * 60_000;

interface WorkerBridgeSnapshot {
  state: string;
  currentText: string;
  lastText: string;
  sessionId?: string | null;
  sessionMode?: string | null;
  pendingPermissions?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
  outputEntries?: NonNullable<bridge.AgentRecord["outputEntries"]>;
  stderrBuffer: string[];
  stopReason: string | null;
}

interface WorkerObserverState {
  fingerprint: string;
  lastChangedAt: number;
  lastMeaningfulActivityAt: number;
  progressSignature: string;
  idleNotified: boolean;
  stuckNotified: boolean;
}

export interface DerivedWorkerEvent {
  type: string;
  summary: string;
  shouldWakeSupervisor: boolean;
  updatesActivity: boolean;
}

const observerIntervals = new Map<string, ReturnType<typeof setInterval>>();
const observerState = new Map<string, WorkerObserverState>();
const recentWorkerEventKeys = new Map<string, number>();
const TYPE_DEDUPED_WORKER_EVENT_TYPES = new Set([
  "worker_error",
  "worker_idle",
  "worker_stopped",
  "worker_stuck",
]);
const EXACT_DEDUPED_WORKER_EVENT_TYPES = new Set([
  "worker_output_changed",
]);
const FATAL_STDERR_PATTERNS = [
  /ACP write error:/i,
  /\bEPIPE\b/i,
  /\bECONNRESET\b/i,
  /\bERR_STREAM_DESTROYED\b/i,
];

function stateKey(runId: string, workerId: string) {
  return `${runId}:${workerId}`;
}

function isPathInside(childPath: string, parentPath: string) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function getWorkerCwdMismatch(args: {
  projectPath: string | null | undefined;
  workerCwd: string;
}) {
  if (!args.projectPath?.trim()) {
    return null;
  }

  const projectPath = path.resolve(args.projectPath);
  const workerCwd = args.workerCwd.trim();
  if (!path.isAbsolute(workerCwd)) {
    return {
      projectPath,
      workerCwd: args.workerCwd,
      summary: `Worker launched outside run project directory: worker cwd "${args.workerCwd}" is not absolute; run project is "${projectPath}".`,
    };
  }

  const resolvedWorkerCwd = path.resolve(workerCwd);
  if (isPathInside(resolvedWorkerCwd, projectPath)) {
    return null;
  }

  return {
    projectPath,
    workerCwd: resolvedWorkerCwd,
    summary: `Worker launched outside run project directory: worker cwd "${resolvedWorkerCwd}" is outside run project "${projectPath}".`,
  };
}

async function failRunForWorkerCwdMismatch(args: {
  runId: string;
  worker: typeof workers.$inferSelect;
  mismatch: NonNullable<ReturnType<typeof getWorkerCwdMismatch>>;
  now: number;
}) {
  let cancelError: string | null = null;
  try {
    await bridge.cancelAgent(args.worker.id);
  } catch (error) {
    cancelError = formatErrorMessage(error);
  }

  await insertExecutionEvent(args.runId, args.worker.id, "worker_environment_mismatch", {
    summary: args.mismatch.summary,
    projectPath: args.mismatch.projectPath,
    workerCwd: args.worker.cwd,
    resolvedWorkerCwd: args.mismatch.workerCwd,
    cancelError,
  });

  await db.update(workers).set({
    status: "error",
    updatedAt: new Date(args.now),
  }).where(eq(workers.id, args.worker.id));
  notifyEventStreamSubscribers();

  stopRunObserver(args.runId);
  await persistRunFailure(args.runId, new Error(`${args.mismatch.summary} Worker: ${args.worker.id}. This is an OmniHarness runtime bug; stopping the run instead of retrying the worker.`));
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
      sessionId: typeof snapshot.sessionId === "string" ? snapshot.sessionId : null,
      sessionMode: typeof snapshot.sessionMode === "string" ? snapshot.sessionMode : null,
      pendingPermissions: snapshot.pendingPermissions ?? [],
      outputEntries: Array.isArray(snapshot.outputEntries) ? snapshot.outputEntries : [],
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

function normalizeProgressText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function progressSignature(snapshot: WorkerBridgeSnapshot) {
  return JSON.stringify({
    state: snapshot.state,
    currentText: normalizeProgressText(snapshot.currentText),
    lastText: normalizeProgressText(snapshot.lastText),
    pendingPermissions: snapshot.pendingPermissions ?? [],
    stopReason: snapshot.stopReason,
  });
}

function parseSnapshotFingerprint(fingerprint: string | undefined) {
  if (!fingerprint) {
    return null;
  }

  try {
    return JSON.parse(fingerprint) as { state?: unknown; stopReason?: unknown };
  } catch {
    return null;
  }
}

function getFatalBridgeStderr(stderrBuffer: string[]) {
  const fatalLine = [...stderrBuffer]
    .reverse()
    .find((line) => FATAL_STDERR_PATTERNS.some((pattern) => pattern.test(line)));

  return fatalLine?.trim() || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function collectPermissionContextParts(
  snapshot: WorkerBridgeSnapshot,
  permission: NonNullable<WorkerBridgeSnapshot["pendingPermissions"]>[number],
) {
  const permissionEntries = [...(snapshot.outputEntries ?? [])]
    .reverse()
    .filter((entry) => entry.type === "permission");

  const matchingEntry = permissionEntries.find((entry) => {
    const raw = asRecord(entry.raw);
    return typeof raw?.requestId === "number" && raw.requestId === permission.requestId;
  }) ?? permissionEntries[0] ?? null;

  if (!matchingEntry) {
    return [];
  }

  const raw = asRecord(matchingEntry.raw);
  const toolCall = asRecord(raw?.toolCall);
  const rawInput = asRecord(toolCall?.rawInput);
  return [
    matchingEntry.text,
    typeof toolCall?.title === "string" ? toolCall.title : "",
    typeof rawInput?.description === "string" ? rawInput.description : "",
    typeof rawInput?.command === "string" ? rawInput.command : "",
  ]
    .map((part) => part.trim())
    .filter(Boolean);
}

function pickApprovalOption(
  permission: NonNullable<WorkerBridgeSnapshot["pendingPermissions"]>[number],
) {
  const options = permission.options ?? [];
  return (
    options.find((option) => option.kind === "allow_always")?.optionId ??
    options.find((option) => option.optionId === "allow_always")?.optionId ??
    options.find((option) => option.kind === "allow")?.optionId ??
    options.find((option) => option.optionId === "allow")?.optionId ??
    options.find((option) => /^allow/i.test(option.kind) || /^allow/i.test(option.optionId))?.optionId ??
    null
  );
}

async function autoApproveSafePermissions(
  runId: string,
  workerId: string,
  snapshot: WorkerBridgeSnapshot,
  now: number,
) {
  const pendingPermissions = snapshot.pendingPermissions ?? [];
  const autoApprovedRequestIds: number[] = [];

  for (const permission of pendingPermissions) {
    const contextParts = collectPermissionContextParts(snapshot, permission);
    const requestSummary = contextParts.join("\n").trim();
    if (!requestSummary || !shouldAutoApprove(requestSummary)) {
      continue;
    }

    const optionId = pickApprovalOption(permission);
    if (!optionId) {
      continue;
    }

    await bridge.approvePermission(workerId, optionId);
    autoApprovedRequestIds.push(permission.requestId);
    await insertExecutionEvent(runId, workerId, "worker_permission_auto_approved", {
      summary: `Auto-approved permission for ${workerId}`,
      requestId: permission.requestId,
      optionId,
      requestSummary: requestSummary.slice(0, 1000),
    });
  }

  if (autoApprovedRequestIds.length > 0) {
    await db.update(workers).set({
      updatedAt: new Date(now),
    }).where(eq(workers.id, workerId));
  }

  return {
    autoApprovedRequestIds,
    autoApprovedAllPending:
      pendingPermissions.length > 0 && autoApprovedRequestIds.length === pendingPermissions.length,
  };
}

export function deriveWorkerEvents(args: {
  workerId: string;
  snapshot: WorkerBridgeSnapshot;
  previous: WorkerObserverState | undefined;
  now: number;
}): { nextState: WorkerObserverState; events: DerivedWorkerEvent[] } {
  const fingerprint = snapshotFingerprint(args.snapshot);
  const previous = args.previous;
  const previousSnapshot = parseSnapshotFingerprint(previous?.fingerprint);
  const changed = !previous || previous.fingerprint !== fingerprint;
  const currentProgressSignature = progressSignature(args.snapshot);
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
  const madeMeaningfulProgress = !previous || previous.progressSignature !== currentProgressSignature;
  const lastMeaningfulActivityAt = madeMeaningfulProgress
    ? args.now
    : previous?.lastMeaningfulActivityAt ?? lastChangedAt;
  const silenceMs = Math.max(0, args.now - lastMeaningfulActivityAt);
  const events: DerivedWorkerEvent[] = [];
  let idleNotified = previous?.idleNotified ?? false;
  let stuckNotified = previous?.stuckNotified ?? false;

  if (changed) {
    events.push({
      type: "worker_output_changed",
      summary: `${args.workerId} output changed`,
      shouldWakeSupervisor: false,
      updatesActivity: madeMeaningfulProgress,
    });
    if (madeMeaningfulProgress) {
      idleNotified = false;
      stuckNotified = false;
    }
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

  if (!idleNotified && silenceMs >= IDLE_THRESHOLD_MS && silenceMs < STUCK_THRESHOLD_MS) {
    events.push({
      type: "worker_idle",
      summary: `${args.workerId} has been idle for ${Math.round(silenceMs / 1000)} seconds`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
    idleNotified = true;
  }

  if (!stuckNotified && silenceMs >= STUCK_THRESHOLD_MS) {
    events.push({
      type: "worker_stuck",
      summary: `${args.workerId} appears stuck after ${Math.round(silenceMs / 1000)} seconds without meaningful progress`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
    stuckNotified = true;
  }

  if (args.snapshot.state === "error" && (!previous || previousSnapshot?.state !== "error")) {
    events.push({
      type: "worker_error",
      summary: `${args.workerId} reported an error state`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
  }

  const stoppedChanged = args.snapshot.state === "stopped" && previousSnapshot?.state !== "stopped";
  const stopReasonChanged = Boolean(args.snapshot.stopReason) && args.snapshot.stopReason !== previousSnapshot?.stopReason;
  if ((!previous && (args.snapshot.stopReason || args.snapshot.state === "stopped")) || stoppedChanged || stopReasonChanged) {
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
      lastMeaningfulActivityAt,
      progressSignature: currentProgressSignature,
      idleNotified,
      stuckNotified,
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
  const serializedDetails = JSON.stringify(details);
  const dedupeScope = TYPE_DEDUPED_WORKER_EVENT_TYPES.has(eventType)
    ? "type"
    : EXACT_DEDUPED_WORKER_EVENT_TYPES.has(eventType)
      ? "exact"
      : null;

  if (dedupeScope) {
    const now = Date.now();
    const eventKey = dedupeScope === "exact"
      ? `${runId}:${workerId}:${eventType}:${serializedDetails}`
      : `${runId}:${workerId}:${eventType}`;
    const recentEventAt = recentWorkerEventKeys.get(eventKey);
    if (recentEventAt && now - recentEventAt < DUPLICATE_WORKER_EVENT_WINDOW_MS) {
      return false;
    }
    recentWorkerEventKeys.set(eventKey, now);

    const duplicate = await db.select({ id: executionEvents.id }).from(executionEvents).where(
      dedupeScope === "exact"
        ? and(
          eq(executionEvents.runId, runId),
          eq(executionEvents.workerId, workerId),
          eq(executionEvents.eventType, eventType),
          eq(executionEvents.details, serializedDetails),
          gt(executionEvents.createdAt, new Date(now - DUPLICATE_WORKER_EVENT_WINDOW_MS)),
        )
        : and(
          eq(executionEvents.runId, runId),
          eq(executionEvents.workerId, workerId),
          eq(executionEvents.eventType, eventType),
          gt(executionEvents.createdAt, new Date(now - DUPLICATE_WORKER_EVENT_WINDOW_MS)),
        ),
    ).get();
    if (duplicate) {
      return false;
    }
  }

  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId,
    planItemId: null,
    eventType,
    details: serializedDetails,
    createdAt: new Date(),
  });
  notifyEventStreamSubscribers();
  return true;
}

async function loadActiveRun(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  return isActiveImplementationRun(run) ? run : null;
}

function isMissingAgentError(error: unknown) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("404")
    || message.includes("not_found")
    || message.includes("agent not found")
    || message.includes("session not found");
}

function isAgentAlreadyExistsError(error: unknown, workerId: string) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("agent already exists") && message.includes(workerId.toLowerCase());
}

async function reviveWorkerFromSavedSession(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  now: number;
}) {
  if (!args.worker.bridgeSessionId) {
    return null;
  }

  let resumedWorker: bridge.AgentRecord;
  try {
    resumedWorker = await bridge.spawnAgent({
      type: args.worker.type,
      cwd: args.worker.cwd,
      name: args.worker.id,
      ...(args.worker.bridgeSessionMode ? { mode: args.worker.bridgeSessionMode } : {}),
      ...(args.run.preferredWorkerModel ? { model: args.run.preferredWorkerModel } : {}),
      ...(args.run.preferredWorkerEffort ? { effort: args.run.preferredWorkerEffort } : {}),
      resumeSessionId: args.worker.bridgeSessionId,
    });
  } catch (error) {
    if (!isAgentAlreadyExistsError(error, args.worker.id)) {
      throw error;
    }
    resumedWorker = await bridge.getAgent(args.worker.id);
  }

  await insertExecutionEvent(args.run.id, args.worker.id, "worker_session_resumed", {
    summary: `Resumed ${args.worker.id} from saved session`,
    sessionId: args.worker.bridgeSessionId,
  });

  await db.update(workers).set({
    status: resumedWorker.state,
    bridgeSessionId: resumedWorker.sessionId ?? args.worker.bridgeSessionId,
    bridgeSessionMode: resumedWorker.sessionMode ?? args.worker.bridgeSessionMode,
    updatedAt: new Date(args.now),
  }).where(eq(workers.id, args.worker.id));
  notifyEventStreamSubscribers();

  return normalizeSnapshot(resumedWorker).snapshot;
}

export async function pollRunWorkers(runId: string, wakeSupervisor: (runId: string, delayMs?: number) => void) {
  const run = await loadActiveRun(runId);
  if (!isActiveImplementationRun(run)) {
    stopRunObserver(runId);
    return;
  }

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const now = Date.now();

  for (const worker of runWorkers) {
    if (worker.status === "cancelled") {
      continue;
    }

    const cwdMismatch = getWorkerCwdMismatch({
      projectPath: run.projectPath,
      workerCwd: worker.cwd,
    });
    if (cwdMismatch) {
      await failRunForWorkerCwdMismatch({
        runId,
        worker,
        mismatch: cwdMismatch,
        now,
      });
      return;
    }

    let snapshot: WorkerBridgeSnapshot;
    try {
      const rawSnapshot = await bridge.getAgent(worker.id);
      const normalized = normalizeSnapshot(rawSnapshot);
      snapshot = normalized.snapshot;

      const latestRun = await loadActiveRun(runId);
      if (!latestRun) {
        stopRunObserver(runId);
        return;
      }

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
      if (!await loadActiveRun(runId)) {
        stopRunObserver(runId);
        return;
      }

      if (run && isMissingAgentError(error)) {
        try {
          const revivedSnapshot = await reviveWorkerFromSavedSession({
            run,
            worker,
            now,
          });
          if (revivedSnapshot) {
            snapshot = revivedSnapshot;
          } else {
            throw error;
          }
        } catch (resumeError) {
          if (!await loadActiveRun(runId)) {
            stopRunObserver(runId);
            return;
          }
          if (isMissingAgentError(resumeError)) {
            await insertExecutionEvent(runId, worker.id, "worker_session_missing", {
              summary: `Saved bridge session for ${worker.id} is no longer available`,
              reason: formatErrorMessage(resumeError),
              sessionId: worker.bridgeSessionId,
            });
            await db.update(workers).set({
              status: "cancelled",
              bridgeSessionId: null,
              bridgeSessionMode: null,
              updatedAt: new Date(now),
            }).where(eq(workers.id, worker.id));
            notifyEventStreamSubscribers();
            wakeSupervisor(runId, 0);
            continue;
          }
          await insertExecutionEvent(runId, worker.id, "worker_resume_failed", {
            summary: `Failed to resume ${worker.id} from saved session`,
            reason: formatErrorMessage(resumeError),
            sessionId: worker.bridgeSessionId,
          });
          stopRunObserver(runId);
          await persistRunFailure(runId, resumeError);
          return;
        }
      } else {
        await insertExecutionEvent(runId, worker.id, "worker_poll_failed", {
          summary: `Observer polling failed for ${worker.id}`,
          reason: formatErrorMessage(error),
          retryable: isTransientSupervisorError(error),
        });
        if (isTransientSupervisorError(error)) {
          continue;
        }
        stopRunObserver(runId);
        await persistRunFailure(runId, error);
        return;
      }
    }

    try {
      const latestRun = await loadActiveRun(runId);
      if (!latestRun) {
        stopRunObserver(runId);
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
      await persistWorkerSnapshot(worker.id, snapshot);

      const fatalBridgeError = getFatalBridgeStderr(snapshot.stderrBuffer);
      if (fatalBridgeError) {
        stopRunObserver(runId);
        await persistRunFailure(runId, new Error(fatalBridgeError));
        return;
      }

      const autoApprovalResult = await autoApproveSafePermissions(runId, worker.id, snapshot, now);
      const filteredEvents = autoApprovalResult.autoApprovedAllPending
        ? events.filter((event) => event.type !== "worker_permission_requested")
        : events;

      const activityEvent = filteredEvents.find((event) => event.updatesActivity);
      const stuckEvent = filteredEvents.find((event) => event.type === "worker_stuck");
      await db.update(workers).set({
        status: stuckEvent ? "stuck" : snapshot.state,
        bridgeSessionId: snapshot.sessionId ?? worker.bridgeSessionId,
        bridgeSessionMode: snapshot.sessionMode ?? worker.bridgeSessionMode,
        updatedAt: activityEvent ? new Date(now) : worker.updatedAt,
      }).where(eq(workers.id, worker.id));
      notifyEventStreamSubscribers();

      for (const event of filteredEvents) {
        const insertedEvent = await insertExecutionEvent(runId, worker.id, event.type, {
          summary: event.summary,
          state: snapshot.state,
          stopReason: snapshot.stopReason,
          currentText: snapshot.currentText.slice(-1000),
          lastText: snapshot.lastText.slice(-1000),
        });
        if (insertedEvent && event.shouldWakeSupervisor && latestRun.status !== "awaiting_user") {
          wakeSupervisor(runId, 0);
        }
      }
    } catch (error) {
      if (!await loadActiveRun(runId)) {
        stopRunObserver(runId);
        return;
      }
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
  for (const key of recentWorkerEventKeys.keys()) {
    if (key.startsWith(`${runId}:`)) {
      recentWorkerEventKeys.delete(key);
    }
  }
}

export async function latestRunWorkerEvents(runId: string) {
  return db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).orderBy(desc(executionEvents.createdAt));
}
