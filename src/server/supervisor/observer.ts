import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import path from "path";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, runs, workers } from "@/server/db/schema";
import { shouldAutoApprove } from "@/server/permissions";
import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
import { isActiveImplementationRun } from "@/server/runs/status";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { extractQuotaResetInfo, parseQuotaResetText } from "@/server/quota/reset-parser";
import { handleWorkerQuotaExhaustion } from "@/server/quota/recovery";
import { isLongWorkerCompletionText, normalizeWorkerStatus } from "@/server/supervisor/worker-completion";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyRunLifecycleEventBestEffort } from "@/server/notifications/triggers";
import { deriveWorkerTerminalProcesses } from "@/lib/worker-terminal-processes";

const OBSERVER_INTERVAL_MS = 5_000;
const IDLE_THRESHOLD_MS = 30_000;
const STUCK_THRESHOLD_MS = 5 * 60_000;
const DUPLICATE_WORKER_EVENT_WINDOW_MS = 5 * 60_000;
const WORKER_TURN_COMPLETED_EVENT_TYPE = "worker_turn_completed";
const WORKER_TURN_COMPLETION_RESET_EVENT_TYPES = [
  "worker_prompted",
  "worker_spawned",
  "worker_session_resumed",
];
const WORKER_TURN_COMPLETION_RELATED_EVENT_TYPES = [
  WORKER_TURN_COMPLETED_EVENT_TYPE,
  ...WORKER_TURN_COMPLETION_RESET_EVENT_TYPES,
];

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
  completionHintNotified?: boolean;
}

export interface DerivedWorkerEvent {
  type: string;
  summary: string;
  shouldWakeSupervisor: boolean;
  updatesActivity: boolean;
}

const TERMINAL_WORKER_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "canceled",
  "error",
  "stopped",
]);

function isTerminalWorkerStatus(status: string) {
  return TERMINAL_WORKER_STATUSES.has(status.toLowerCase());
}

const observerIntervals = new Map<string, ReturnType<typeof setInterval>>();
const observerPollsInFlight = new Map<string, number>();
const observerGenerations = new Map<string, number>();
const observerState = new Map<string, WorkerObserverState>();
const recentWorkerEventKeys = new Map<string, number>();
const TYPE_DEDUPED_WORKER_EVENT_TYPES = new Set([
  "worker_error",
  "worker_idle",
  "worker_session_missing",
  "worker_stopped",
  "worker_stuck",
]);
const EXACT_DEDUPED_WORKER_EVENT_TYPES = new Set([
  "worker_output_changed",
]);
const FATAL_STDERR_PATTERNS = [
  /ACP write error:/i,
  /\bEPIPE\b/i,
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

function hasActiveTerminalProcess(snapshot: WorkerBridgeSnapshot) {
  return deriveWorkerTerminalProcesses(snapshot.outputEntries ?? [])
    .some((process) => process.active);
}

function hasLongCompletionHint(snapshot: WorkerBridgeSnapshot) {
  if (snapshot.currentText.trim()) {
    return isLongWorkerCompletionText(snapshot.currentText);
  }

  return normalizeWorkerStatus(snapshot.state) !== "working"
    && isLongWorkerCompletionText(snapshot.lastText);
}

function hasCompletedIdleTurn(snapshot: WorkerBridgeSnapshot) {
  return normalizeWorkerStatus(snapshot.state) === "idle"
    && snapshot.stopReason === "end_turn"
    && Boolean((snapshot.currentText || snapshot.lastText).trim());
}

function resolvePersistedWorkerStatus(snapshot: WorkerBridgeSnapshot, events: DerivedWorkerEvent[]) {
  if (events.some((event) => event.type === "worker_stuck")) {
    return "stuck";
  }

  if (
    hasCompletedIdleTurn(snapshot)
    || events.some((event) => event.type === WORKER_TURN_COMPLETED_EVENT_TYPE)
  ) {
    return "idle";
  }

  return snapshot.state;
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

function getSnapshotQuotaText(snapshot: WorkerBridgeSnapshot) {
  const diagnosticText = [
    ...snapshot.stderrBuffer.slice(-20),
    snapshot.stopReason ?? "",
  ].filter(Boolean).join("\n");
  const diagnosticQuota = parseQuotaResetText(diagnosticText);
  if (diagnosticQuota.isQuotaError) {
    return diagnosticQuota.rawText;
  }

  if (normalizeWorkerStatus(snapshot.state) === "error" || normalizeWorkerStatus(snapshot.state) === "stopped") {
    const visibleText = [snapshot.currentText, snapshot.lastText].filter(Boolean).join("\n");
    const visibleQuota = parseQuotaResetText(visibleText);
    if (visibleQuota.isQuotaError) {
      return visibleQuota.rawText;
    }
  }

  return null;
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
  const toolCallKind = typeof toolCall?.kind === "string" ? toolCall.kind : "";
  const locationPaths = Array.isArray(toolCall?.locations)
    ? toolCall.locations
        .map((location) => (asRecord(location)?.path))
        .filter((path): path is string => typeof path === "string" && path.trim().length > 0)
    : [];
  const rawInputPath = [
    typeof rawInput?.file_path === "string" ? rawInput.file_path : "",
    typeof rawInput?.path === "string" ? rawInput.path : "",
  ].filter((path) => path.trim().length > 0);
  return [
    matchingEntry.text,
    typeof toolCall?.title === "string" ? toolCall.title : "",
    typeof rawInput?.description === "string" ? rawInput.description : "",
    typeof rawInput?.command === "string" ? rawInput.command : "",
    [toolCallKind, ...locationPaths, ...rawInputPath].filter(Boolean).join(" "),
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
  let completionHintNotified = previous?.completionHintNotified ?? false;
  const previousStatus = normalizeWorkerStatus(
    typeof previousSnapshot?.state === "string" ? previousSnapshot.state : null,
  );
  const currentStatus = normalizeWorkerStatus(args.snapshot.state);
  const completedByAcpState = previousStatus === "working" && currentStatus === "idle";
  const longCompletionText = hasLongCompletionHint(args.snapshot);

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
      if (!completedByAcpState && !longCompletionText) {
        completionHintNotified = false;
      }
    }
  }

  if (!completionHintNotified && (completedByAcpState || longCompletionText)) {
    events.push({
      type: WORKER_TURN_COMPLETED_EVENT_TYPE,
      summary: completedByAcpState
        ? `${args.workerId} completed a worker turn`
        : `${args.workerId} produced a long final-looking text turn`,
      shouldWakeSupervisor: true,
      updatesActivity: false,
    });
    completionHintNotified = true;
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

  if (
    !stuckNotified
    && silenceMs >= STUCK_THRESHOLD_MS
    && !hasCompletedIdleTurn(args.snapshot)
    && !hasActiveTerminalProcess(args.snapshot)
  ) {
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
      completionHintNotified,
    },
    events,
  };
}

async function hasExistingWorkerTurnCompletionForCurrentPrompt(runId: string, workerId: string) {
  const latestRelatedEvents = await db.select({
    eventType: executionEvents.eventType,
  }).from(executionEvents).where(and(
    eq(executionEvents.runId, runId),
    eq(executionEvents.workerId, workerId),
    inArray(executionEvents.eventType, WORKER_TURN_COMPLETION_RELATED_EVENT_TYPES),
  )).orderBy(desc(executionEvents.createdAt)).limit(25);

  for (const event of latestRelatedEvents) {
    if (event.eventType === WORKER_TURN_COMPLETED_EVENT_TYPE) {
      return true;
    }

    if (WORKER_TURN_COMPLETION_RESET_EVENT_TYPES.includes(event.eventType)) {
      return false;
    }
  }

  return false;
}

async function insertExecutionEvent(
  runId: string,
  workerId: string,
  eventType: string,
  details: Record<string, unknown>,
) {
  const serializedDetails = JSON.stringify(details);
  if (eventType === WORKER_TURN_COMPLETED_EVENT_TYPE) {
    const duplicate = await hasExistingWorkerTurnCompletionForCurrentPrompt(runId, workerId);
    if (duplicate) {
      return false;
    }
  }

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
  await notifyRunLifecycleEventBestEffort({ runId, eventType, details });
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
  sessionId?: string | null;
  sessionMode?: string | null;
}) {
  const sessionId = args.sessionId?.trim() || args.worker.bridgeSessionId;
  if (!sessionId) {
    return null;
  }
  const sessionMode = args.sessionMode ?? args.worker.bridgeSessionMode;
  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(sessionMode, yoloModeEnabled);

  let resumedWorker: bridge.AgentRecord;
  try {
    resumedWorker = await bridge.spawnAgent({
      type: args.worker.type,
      cwd: args.worker.cwd,
      name: args.worker.id,
      ...(workerMode ? { mode: workerMode } : {}),
      ...(args.run.preferredWorkerModel ? { model: args.run.preferredWorkerModel } : {}),
      ...(args.run.preferredWorkerEffort ? { effort: args.run.preferredWorkerEffort } : {}),
      resumeSessionId: sessionId,
    });
  } catch (error) {
    if (!isAgentAlreadyExistsError(error, args.worker.id)) {
      throw error;
    }
    resumedWorker = await bridge.getAgent(args.worker.id, { retryIndefinitely: false });
  }

  await insertExecutionEvent(args.run.id, args.worker.id, "worker_session_resumed", {
    summary: `Resumed ${args.worker.id} from saved session`,
    sessionId,
  });

  await db.update(workers).set({
    status: resumedWorker.state,
    bridgeSessionId: resumedWorker.sessionId ?? sessionId,
    bridgeSessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    updatedAt: new Date(args.now),
  }).where(eq(workers.id, args.worker.id));
  emitNamedEvent({
    kind: "worker.reattached",
    runId: args.run.id,
    workerId: args.worker.id,
  });
  notifyEventStreamSubscribers();

  return normalizeSnapshot(resumedWorker).snapshot;
}

async function markWorkerSessionMissing(args: {
  runId: string;
  worker: typeof workers.$inferSelect;
  reason: unknown;
  sessionId: string | null | undefined;
  now: number;
}) {
  const insertedEvent = await insertExecutionEvent(args.runId, args.worker.id, "worker_session_missing", {
    summary: `Saved bridge session for ${args.worker.id} is no longer available`,
    reason: formatErrorMessage(args.reason),
    sessionId: args.sessionId,
  });
  await db.update(workers).set({
    status: "cancelled",
    bridgeSessionId: null,
    bridgeSessionMode: null,
    updatedAt: new Date(args.now),
  }).where(eq(workers.id, args.worker.id));
  notifyEventStreamSubscribers();
  return insertedEvent;
}

async function markWorkerResumeFailed(args: {
  runId: string;
  worker: typeof workers.$inferSelect;
  reason: unknown;
  sessionId: string | null | undefined;
  now: number;
}) {
  await insertExecutionEvent(args.runId, args.worker.id, "worker_resume_failed", {
    summary: `Failed to resume ${args.worker.id} from saved session`,
    reason: formatErrorMessage(args.reason),
    sessionId: args.sessionId,
  });
  await db.update(workers).set({
    status: "error",
    bridgeSessionId: null,
    bridgeSessionMode: null,
    updatedAt: new Date(args.now),
  }).where(eq(workers.id, args.worker.id));
  notifyEventStreamSubscribers();
}

export async function pollRunWorkers(runId: string, wakeSupervisor: (runId: string, delayMs?: number) => void) {
  const run = await loadActiveRun(runId);
  if (!run) {
    stopRunObserver(runId);
    return;
  }

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const now = Date.now();

  for (const worker of runWorkers) {
    if (worker.status === "cancelled") {
      continue;
    }

    if (normalizeWorkerStatus(worker.status) === "starting") {
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
      const rawSnapshot = await bridge.getAgent(worker.id, { retryIndefinitely: false });
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

      if (normalizeWorkerStatus(snapshot.state) === "stopped") {
        const resumeSessionId = snapshot.sessionId ?? worker.bridgeSessionId;
        if (resumeSessionId) {
          try {
            const revivedSnapshot = await reviveWorkerFromSavedSession({
              run: latestRun,
              worker,
              now,
              sessionId: resumeSessionId,
              sessionMode: snapshot.sessionMode ?? worker.bridgeSessionMode,
            });
            if (revivedSnapshot) {
              snapshot = revivedSnapshot;
              wakeSupervisor(runId, 0);
            }
          } catch (resumeError) {
            if (!await loadActiveRun(runId)) {
              stopRunObserver(runId);
              return;
            }
            if (isMissingAgentError(resumeError)) {
              const insertedEvent = await markWorkerSessionMissing({
                runId,
                worker,
                reason: resumeError,
                sessionId: resumeSessionId,
                now,
              });
              if (insertedEvent) {
                wakeSupervisor(runId, 0);
              }
              continue;
            }
            await markWorkerResumeFailed({
              runId,
              worker,
              reason: resumeError,
              sessionId: resumeSessionId,
              now,
            });
            stopRunObserver(runId);
            await persistRunFailure(runId, resumeError);
            return;
          }
        }
      }
    } catch (error) {
      if (!await loadActiveRun(runId)) {
        stopRunObserver(runId);
        return;
      }

      const quotaInfo = extractQuotaResetInfo(error);
      if (quotaInfo.isQuotaError) {
        const quotaResult = await handleWorkerQuotaExhaustion({
          runId,
          workerId: worker.id,
          text: quotaInfo.rawText,
          now: new Date(now),
        });
        stopRunObserver(runId);
        if (quotaResult.state === "needs_recovery") {
          wakeSupervisor(runId, 0);
        }
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
            wakeSupervisor(runId, 0);
          } else {
            throw error;
          }
        } catch (resumeError) {
          if (!await loadActiveRun(runId)) {
            stopRunObserver(runId);
            return;
          }
          if (isMissingAgentError(resumeError)) {
            const insertedEvent = await markWorkerSessionMissing({
              runId,
              worker,
              reason: resumeError,
              sessionId: worker.bridgeSessionId,
              now,
            });
            if (insertedEvent) {
              wakeSupervisor(runId, 0);
            }
            continue;
          }
          await markWorkerResumeFailed({
            runId,
            worker,
            reason: resumeError,
            sessionId: worker.bridgeSessionId,
            now,
          });
          stopRunObserver(runId);
          await persistRunFailure(runId, resumeError);
          return;
        }
      } else {
        const retryable = isTransientSupervisorError(error);
        if (retryable) {
          continue;
        }

        await insertExecutionEvent(runId, worker.id, "worker_poll_failed", {
          summary: `Observer polling failed for ${worker.id}`,
          reason: formatErrorMessage(error),
          retryable,
        });
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
      const quotaText = getSnapshotQuotaText(snapshot);
      if (quotaText) {
        const quotaResult = await handleWorkerQuotaExhaustion({
          runId,
          workerId: worker.id,
          text: quotaText,
          now: new Date(now),
        });
        stopRunObserver(runId);
        if (quotaResult.state === "needs_recovery") {
          wakeSupervisor(runId, 0);
        }
        return;
      }

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
      const nextStatus = resolvePersistedWorkerStatus(snapshot, filteredEvents);
      const prevStatus = worker.status;
      await db.update(workers).set({
        status: nextStatus,
        bridgeSessionId: snapshot.sessionId ?? worker.bridgeSessionId,
        bridgeSessionMode: snapshot.sessionMode ?? worker.bridgeSessionMode,
        updatedAt: activityEvent ? new Date(now) : worker.updatedAt,
      }).where(eq(workers.id, worker.id));
      if (nextStatus !== prevStatus) {
        emitNamedEvent({
          kind: "worker.status",
          runId,
          workerId: worker.id,
          prev: prevStatus,
          next: nextStatus,
        });
        if (isTerminalWorkerStatus(nextStatus)) {
          emitNamedEvent({
            kind: "worker.terminal",
            runId,
            workerId: worker.id,
            status: nextStatus,
          });
        }
      }
      notifyEventStreamSubscribers();

      for (const event of filteredEvents) {
        const eventText = (snapshot.currentText || snapshot.lastText || "").slice(-500);
        const insertedEvent = await insertExecutionEvent(runId, worker.id, event.type, {
          summary: event.summary,
          state: snapshot.state,
          stopReason: snapshot.stopReason,
          ...(eventText ? { text: eventText } : {}),
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
  const generation = observerGenerations.get(runId) ?? 0;

  const runPoll = () => {
    if (observerPollsInFlight.has(runId)) {
      return;
    }

    observerPollsInFlight.set(runId, generation);
    void pollRunWorkers(runId, wakeSupervisor)
      .catch((error) => {
        console.error(`Run observer poll failed for ${runId}`, error);
      })
      .finally(() => {
        if (observerPollsInFlight.get(runId) === generation) {
          observerPollsInFlight.delete(runId);
        }
      });
  };

  const interval = setInterval(() => {
    runPoll();
  }, OBSERVER_INTERVAL_MS);

  observerIntervals.set(runId, interval);
  runPoll();
}

export function stopRunObserver(runId: string) {
  observerGenerations.set(runId, (observerGenerations.get(runId) ?? 0) + 1);
  observerPollsInFlight.delete(runId);

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
