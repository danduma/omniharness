import { type AppErrorDescriptor, normalizeAppError } from "@/lib/app-errors";
import { formatHumanDuration, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import { getLatestUnresolvedWorkerStuckEvent } from "@/lib/worker-stuck-events";
import { WORKER_OPTIONS, FALLBACK_WORKER_MODEL_OPTIONS } from "./constants";
import type { AgentSnapshot, EventStreamState, ExecutionEventRecord, MessageRecord, PlanItemRecord, PlanRecord, RunRecord, SupervisorInterventionRecord, WorkerModelCatalog, WorkerType } from "./types";
import { t } from "@/lib/i18n";

export { getLatestUnresolvedWorkerStuckEvent };

export function buildInlineError(
  error: unknown,
  fallback: Partial<AppErrorDescriptor> = {},
): AppErrorDescriptor {
  return normalizeAppError(error, fallback);
}

export function removeRunFromHomeState(current: EventStreamState, runId: string): EventStreamState {
  const runToDelete = (current.runs || []).find((run: RunRecord) => run.id === runId);
  const workerIds = (current.workers || [])
    .filter((worker: { runId: string; id: string }) => worker.runId === runId)
    .map((worker: { id: string }) => worker.id);

  return {
    ...current,
    runs: (current.runs || []).filter((run: RunRecord) => run.id !== runId),
    messages: (current.messages || []).filter((message: { runId: string }) => message.runId !== runId),
    workers: (current.workers || []).filter((worker: { runId: string }) => worker.runId !== runId),
    clarifications: (current.clarifications || []).filter((item: { runId: string }) => item.runId !== runId),
    executionEvents: (current.executionEvents || []).filter((item: { runId: string; workerId?: string | null }) =>
      item.runId !== runId && (!item.workerId || !workerIds.includes(item.workerId))
    ),
    supervisorInterventions: (current.supervisorInterventions || []).filter((item: { runId: string; workerId?: string | null }) =>
      item.runId !== runId && (!item.workerId || !workerIds.includes(item.workerId))
    ),
    queuedMessages: (current.queuedMessages || []).filter((item) => item.runId !== runId),
    plans: runToDelete
      ? (current.plans || []).filter((plan: PlanRecord) => plan.id !== runToDelete.planId)
      : current.plans,
    planItems: runToDelete
      ? (current.planItems || []).filter((item: PlanItemRecord) => item.planId !== runToDelete.planId)
      : current.planItems,
    readMarkers: Object.fromEntries(
      Object.entries(current.readMarkers ?? {}).filter(([candidateRunId]) => candidateRunId !== runId),
    ),
  };
}

export function getConversationTranscriptRunIds({
  selectedRunId,
  selectedRun,
}: {
  selectedRunId: string | null;
  selectedRun: RunRecord | null;
}) {
  if (!selectedRunId) {
    return [] as string[];
  }

  if (selectedRun?.mode === "implementation" && selectedRun.parentRunId?.trim()) {
    return [selectedRun.parentRunId.trim(), selectedRunId];
  }

  return [selectedRunId];
}

export function filterPromotedPlanningTranscriptMessages({
  messages,
  selectedRun,
}: {
  messages: MessageRecord[];
  selectedRun: RunRecord | null;
}) {
  const parentRunId = selectedRun?.parentRunId?.trim();
  if (!selectedRun || !parentRunId || selectedRun.mode !== "implementation") {
    return messages;
  }

  const parentUserMessageKeys = new Set(
    messages
      .filter((message) => message.runId === parentRunId && message.role === "user")
      .map((message) => `${message.kind ?? ""}\n${message.content.trim()}`),
  );

  return messages.filter((message) => {
    if (message.runId !== selectedRun.id || message.role !== "user") {
      return true;
    }

    return !parentUserMessageKeys.has(`${message.kind ?? ""}\n${message.content.trim()}`);
  });
}

export function filterOptimisticallyDeletedRuns(
  current: EventStreamState,
  pendingDeletedRunIds: ReadonlySet<string>,
): EventStreamState {
  if (pendingDeletedRunIds.size === 0) {
    return current;
  }

  let next = current;
  for (const runId of pendingDeletedRunIds) {
    next = removeRunFromHomeState(next, runId);
  }
  return next;
}

export function appendSentConversationMessageSnapshot(
  current: EventStreamState,
  message: MessageRecord | null | undefined,
): EventStreamState {
  if (!message) {
    return current;
  }

  const messages = current.messages || [];
  if (messages.some((existing) => existing.id === message.id)) {
    return current;
  }

  return {
    ...current,
    messages: [...messages, message],
    runs: (current.runs || []).map((run) => (
      run.id === message.runId
        ? { ...run, status: "running", failedAt: null, lastError: null, updatedAt: message.createdAt }
        : run
    )),
  };
}

export function mergePendingSentConversationMessages(
  incomingState: EventStreamState,
  pendingMessages: Map<string, MessageRecord>,
): EventStreamState {
  if (pendingMessages.size === 0) {
    return incomingState;
  }

  const serverMessageIds = new Set((incomingState.messages || []).map((message) => message.id));
  let nextState = incomingState;

  for (const [messageId, message] of Array.from(pendingMessages.entries())) {
    if (serverMessageIds.has(messageId)) {
      pendingMessages.delete(messageId);
    } else {
      nextState = appendSentConversationMessageSnapshot(nextState, message);
    }
  }

  return nextState;
}

export type CreatedConversationSnapshot = {
  plan?: PlanRecord | null;
  run?: RunRecord | null;
  message?: MessageRecord | null;
  serverVisibleAtMs?: number;
};

export function appendCreatedConversationSnapshot(
  current: EventStreamState,
  snapshot: CreatedConversationSnapshot | null | undefined,
): EventStreamState {
  const run = snapshot?.run;
  if (!run) {
    return current;
  }

  const plan = snapshot.plan;
  const message = snapshot.message;
  const nextPlans = plan && !(current.plans || []).some((existingPlan) => existingPlan.id === plan.id)
    ? [...(current.plans || []), plan]
    : current.plans || [];
  const nextRuns = (current.runs || []).some((existingRun) => existingRun.id === run.id)
    ? (current.runs || []).map((existingRun) => existingRun.id === run.id ? { ...existingRun, ...run } : existingRun)
    : [run, ...(current.runs || [])];
  const nextMessages = message && !(current.messages || []).some((existingMessage) => existingMessage.id === message.id)
    ? [...(current.messages || []), message]
    : current.messages || [];

  return {
    ...current,
    plans: nextPlans,
    runs: nextRuns,
    messages: nextMessages,
  };
}

function isCreatedConversationSnapshotServerVisible(
  incomingState: EventStreamState,
  snapshot: CreatedConversationSnapshot,
) {
  const run = snapshot.run;
  if (!run) {
    return false;
  }

  const hasRun = (incomingState.runs || []).some((existingRun) => existingRun.id === run.id);
  const hasPlan = !snapshot.plan || (incomingState.plans || []).some((existingPlan) => existingPlan.id === snapshot.plan?.id);
  const hasMessage = !snapshot.message || (incomingState.messages || []).some((existingMessage) => existingMessage.id === snapshot.message?.id);

  return hasRun && hasPlan && hasMessage;
}

export function mergePendingCreatedConversationSnapshots(
  incomingState: EventStreamState,
  pendingSnapshots: Map<string, CreatedConversationSnapshot>,
  nowMs = Date.now(),
): EventStreamState {
  if (pendingSnapshots.size === 0) {
    return incomingState;
  }

  let nextState = incomingState;

  for (const snapshot of Array.from(pendingSnapshots.values())) {
    if (isCreatedConversationSnapshotServerVisible(incomingState, snapshot)) {
      // A stale in-flight SSE snapshot can still arrive after the server has
      // caught up once, so keep the optimistic create snapshot around until an
      // explicit delete/archive removes it from the pending map.
      snapshot.serverVisibleAtMs ??= nowMs;
      continue;
    }

    nextState = appendCreatedConversationSnapshot(nextState, snapshot);
  }

  return nextState;
}

export function shouldShowConversationExecutionPanel({
  selectedRun,
  isConversationThinking,
  executionEventCount,
}: {
  selectedRun: RunRecord | null;
  isConversationThinking: boolean;
  executionEventCount: number;
}) {
  return Boolean(selectedRun && (isConversationThinking || executionEventCount > 0));
}

const RECOVERABLE_RUNNING_GRACE_MS = 30_000;

export function shouldShowRecoverableRunningState({
  selectedRun,
  latestUserCheckpoint,
  hasPendingPermission,
  hasActiveWorker,
  hasStuckWorker,
  activeWorkerCount,
  latestExecutionEventCreatedAt,
  nowMs = Date.now(),
}: {
  selectedRun: RunRecord | null;
  latestUserCheckpoint: MessageRecord | null;
  hasPendingPermission: boolean;
  hasActiveWorker: boolean;
  hasStuckWorker: boolean;
  activeWorkerCount: number;
  latestExecutionEventCreatedAt: string | null | undefined;
  nowMs?: number;
}) {
  if (
    selectedRun?.status !== "running"
    || !latestUserCheckpoint
    || hasPendingPermission
    || hasActiveWorker
  ) {
    return false;
  }

  if (hasStuckWorker) {
    return true;
  }

  if (activeWorkerCount > 0) {
    return false;
  }

  const referenceTimestamp = latestExecutionEventCreatedAt || selectedRun.createdAt;
  const referenceTimeMs = new Date(referenceTimestamp).getTime();
  if (!Number.isFinite(referenceTimeMs)) {
    return false;
  }

  return nowMs - referenceTimeMs >= RECOVERABLE_RUNNING_GRACE_MS;
}

export function shouldOpenExecutionDetailsForRun({
  selectedRun,
  executionEventCount,
}: {
  selectedRun: RunRecord | null;
  executionEventCount: number;
}) {
  return Boolean(selectedRun?.status === "failed" && executionEventCount > 0);
}

export type ConversationTimelineItem =
  | { type: "message"; id: string; createdAt: string; message: MessageRecord }
  | { type: "activity"; id: string; createdAt: string; event?: ExecutionEventRecord; text: string };

export type ConversationSignalDestination =
  | "main_conversation"
  | "inline_event"
  | "dynamic_status"
  | "run_log";

const RUN_LOG_ONLY_EVENT_TYPES = new Set([
  "auth.login_failed",
  "auth.login_rate_limited",
  "auth.login_succeeded",
  "auth.logout",
  "auth.logout_all",
  "auth.pairing_created",
  "auth.pairing_redeemed",
  "auth.pairing_rejected",
  "auth.session_revoked",
  "clarification_resolved",
  "clarifications_requested",
  "conversation_title_generation_failed",
  "plan_items_synced",
  "run_failed",
  "supervisor_context_compacted",
  "supervisor_file_read",
  "supervisor_repo_inspected",
  "supervisor_turn_stopped",
  "supervisor_wait",
  "worker_idle",
  "worker_mode_changed",
  "worker_output_changed",
  "worker_permission_auto_approved",
  "worker_prompted",
  "worker_session_resumed",
  "worker_snapshot_invalid",
  "worker_stopped",
  "worker_turn_completed",
]);

const INTERNAL_OPERATIONAL_EVENT_TYPES = new Set([
  "supervisor_turn_stopped",
  "worker_session_missing",
  "worker_spawn_blocked",
  "worker_stuck",
]);

const DYNAMIC_STATUS_EVENT_TYPES = new Set([
  "worker_prompt_deferred",
]);

const INLINE_CONVERSATION_EVENT_TYPES = new Set([
  "auto_commit_created",
  "auto_commit_failed",
  "auto_commit_push_created",
  "auto_commit_push_failed",
  "auto_commit_skipped",
  "clarification_requested",
  "worker_cancelled",
  "worker_error",
  "worker_failover_started",
  "worker_handoff_emitted",
  "worker_failover_completed",
  "worker_permission_approved",
  "worker_permission_denied",
  "worker_permission_requested",
  "worker_prompt_failed",
  "worker_environment_mismatch",
  "worker_spawned",
]);

const MESSAGE_MIRRORED_CONVERSATION_TIMELINE_EVENT_TYPES = new Set([
  "clarification_requested",
  "run_completed",
  "worker_cancelled",
  "worker_permission_approved",
  "worker_permission_denied",
  "worker_spawned",
]);

const USER_VISIBLE_MESSAGE_ROLES = new Set([
  "user",
  "supervisor",
  "worker",
]);

export function classifyExecutionEvent(event: ExecutionEventRecord): ConversationSignalDestination {
  if (INLINE_CONVERSATION_EVENT_TYPES.has(event.eventType)) {
    return "inline_event";
  }

  if (DYNAMIC_STATUS_EVENT_TYPES.has(event.eventType)) {
    return "dynamic_status";
  }

  if (RUN_LOG_ONLY_EVENT_TYPES.has(event.eventType)) {
    return "run_log";
  }

  return "run_log";
}

export function shouldShowExecutionEventInRunLog(event: ExecutionEventRecord) {
  if (INTERNAL_OPERATIONAL_EVENT_TYPES.has(event.eventType)) {
    return false;
  }

  if (event.eventType !== "worker_poll_failed") {
    return true;
  }

  const details = parseExecutionEventDetails(event.details);
  return details.retryable !== true;
}

export function shouldRenderMessageInMainConversation(message: MessageRecord) {
  if (!USER_VISIBLE_MESSAGE_ROLES.has(message.role)) {
    return false;
  }

  if (message.role === "worker" && !message.content.trim()) {
    return false;
  }

  return true;
}

function timestampMs(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function compareOldestByCreatedAtThenId<T extends { createdAt: string; id: string }>(a: T, b: T) {
  const timeDelta = timestampMs(a.createdAt) - timestampMs(b.createdAt);
  return timeDelta !== 0 ? timeDelta : a.id.localeCompare(b.id);
}

export function compareNewestByCreatedAtThenId<T extends { createdAt: string; id: string }>(a: T, b: T) {
  const timeDelta = timestampMs(b.createdAt) - timestampMs(a.createdAt);
  return timeDelta !== 0 ? timeDelta : b.id.localeCompare(a.id);
}

function hasNearbyMirroredMessage(event: ExecutionEventRecord, messages: MessageRecord[]) {
  if (!MESSAGE_MIRRORED_CONVERSATION_TIMELINE_EVENT_TYPES.has(event.eventType)) {
    return false;
  }

  const eventTime = timestampMs(event.createdAt);
  return messages.some((message) => (
    message.runId === event.runId
    && (message.kind === "supervisor_action" || message.kind === "clarification" || message.kind === "completion")
    && Math.abs(timestampMs(message.createdAt) - eventTime) <= 2_000
  ));
}

function shouldShowExecutionEventInTimeline(event: ExecutionEventRecord, messages: MessageRecord[]) {
  if (classifyExecutionEvent(event) !== "inline_event") {
    return false;
  }

  return !hasNearbyMirroredMessage(event, messages);
}

export function buildConversationTimelineItems({
  messages,
  executionEvents,
  supervisorInterventions = [],
  workers = [],
  runMode = null,
}: {
  messages: MessageRecord[];
  executionEvents: ExecutionEventRecord[];
  supervisorInterventions?: SupervisorInterventionRecord[];
  workers?: ConversationWorkerRecord[];
  runMode?: RunRecord["mode"] | null;
}): ConversationTimelineItem[] {
  const items: ConversationTimelineItem[] = messages
    .filter(shouldRenderMessageInMainConversation)
    .map((message) => ({
      type: "message",
      id: message.id,
      createdAt: message.createdAt,
      message,
    }));
  const sortedExecutionEvents = [...executionEvents].sort((a, b) => {
    const timeDelta = timestampMs(a.createdAt) - timestampMs(b.createdAt);
    return timeDelta !== 0 ? timeDelta : a.id.localeCompare(b.id);
  });
  const workerIdsWithSpawnEvents = new Set(
    executionEvents
      .filter((event) => event.eventType === "worker_spawned" && event.workerId)
      .map((event) => event.workerId as string),
  );

  for (const worker of workers) {
    if (!worker.createdAt || workerIdsWithSpawnEvents.has(worker.id)) {
      continue;
    }

    items.push({
      type: "activity",
      id: `worker-start:${worker.id}`,
      createdAt: worker.createdAt,
      text: summarizeWorkerStartRecord(worker, runMode),
    });
  }

  for (const event of sortedExecutionEvents) {
    if (!shouldShowExecutionEventInTimeline(event, messages)) {
      continue;
    }

    const text = (event.eventType === "worker_spawned"
      ? summarizeWorkerSpawnEvent(event, runMode)
      : summarizeInlineEvent(event))?.trim() ?? "";
    if (!text) {
      continue;
    }

    items.push({
      type: "activity",
      id: event.id,
      createdAt: event.createdAt,
      event,
      text,
    });
  }

  for (const intervention of supervisorInterventions) {
    const text = summarizeSupervisorIntervention(intervention);
    if (!text) {
      continue;
    }

    items.push({
      type: "activity",
      id: intervention.id,
      createdAt: intervention.createdAt,
      text,
    });
  }

  return items.sort((a, b) => {
    const timeDelta = timestampMs(a.createdAt) - timestampMs(b.createdAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }
    if (a.type !== b.type) {
      return a.type === "message" ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
}

export function stripRunFailurePrefix(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/^run failed:\s*/i, "").trim();
}

export function extractWorkerFailureDetail(messages: MessageRecord[]) {
  const workerMessages = [...messages]
    .filter((message) => message.role === "worker")
    .sort(compareNewestByCreatedAtThenId);

  for (const message of workerMessages) {
    const detailMatch = message.content.match(/"detail":"([^"]+)"/i);
    if (detailMatch?.[1]) {
      return detailMatch[1];
    }

    const errorLine = message.content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => /^error[:\s]/i.test(line) || /^failed[:\s]/i.test(line));
    if (errorLine) {
      return errorLine.replace(/^(error|failed)[:\s]*/i, "").trim();
    }
  }

  return "";
}

export function parseWorkerTypes(value: string | null | undefined): WorkerType[] {
  if (!value?.trim()) {
    return WORKER_OPTIONS.map((option) => option.value);
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return WORKER_OPTIONS.map((option) => option.value);
    }

    const allowed = new Set(WORKER_OPTIONS.map((option) => option.value));
    const normalized = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry): entry is WorkerType => allowed.has(entry as WorkerType));

    return normalized.length > 0 ? Array.from(new Set(normalized)) : WORKER_OPTIONS.map((option) => option.value);
  } catch {
    return WORKER_OPTIONS.map((option) => option.value);
  }
}

export function parseProjectList(value: string | null | undefined) {
  if (!value?.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function parseCollapsedProjectPaths(value: string | null | undefined) {
  if (!value?.trim()) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0));
  } catch {
    return new Set<string>();
  }
}

export function parseWorkerType(value: string | null | undefined): WorkerType | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return WORKER_OPTIONS.some((option) => option.value === normalized) ? normalized as WorkerType : null;
}

export function parseBooleanSetting(value: string | null | undefined, defaultValue: boolean) {
  if (!value?.trim()) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function summarizeThought(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

export function parseExecutionEventDetails(details: string | null | undefined) {
  if (!details) {
    return {} as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function formatExecutionWorkerLabel(workerId: string | null | undefined) {
  const normalized = workerId?.trim();
  if (!normalized) {
    return "worker";
  }

  const match = normalized.match(/(?:^|-)worker-(\d+)$/);
  return match ? `worker-${match[1]}` : normalized;
}

export function formatExecutionEventType(eventType: string) {
  if (eventType === "supervisor_turn_stopped") {
    return "Turn pause";
  }
  return eventType.replace(/[._]/g, " ");
}

function formatConversationWorkerLabel(workerId: string | null | undefined) {
  const normalized = workerId?.trim();
  if (!normalized) {
    return "worker";
  }

  const match = normalized.match(/(?:^|-)worker-(\d+)$/);
  return match ? `worker ${match[1]}` : normalized;
}

function normalizeSentence(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function lowerFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}

function extractSpawnTitle(summary: string) {
  const match = summary.match(/(?:^|\|\s*)Title:\s*(.+?)(?:\.\s*(?:\||$)|\s*\||$)/i);
  return match?.[1]?.trim() ?? "";
}

function summarizeTaskText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const truncated = normalized.length > 180 ? `${normalized.slice(0, 180).trim()}...` : normalized;
  return normalizeSentence(truncated);
}

function isPlanningRunMode(runMode: RunRecord["mode"] | null | undefined) {
  return runMode === "planning";
}

function summarizeWorkerSpawnEvent(event: ExecutionEventRecord, runMode?: RunRecord["mode"] | null) {
  if (isPlanningRunMode(runMode)) {
    return t("conversation.activity.startPlanningAgent");
  }

  const details = parseExecutionEventDetails(event.details);
  const summary = typeof details.summary === "string" ? details.summary.trim() : "";
  const purpose = typeof details.purpose === "string" ? details.purpose.trim() : "";
  const title = typeof details.title === "string" && details.title.trim()
    ? details.title.trim()
    : extractSpawnTitle(summary);
  const task = summarizeTaskText(purpose || title);
  const workerLabel = formatConversationWorkerLabel(event.workerId);

  return task
    ? `Starting ${workerLabel} to ${lowerFirst(task)}`
    : `Starting ${workerLabel}.`;
}

function summarizeWorkerStartRecord(worker: ConversationWorkerRecord, runMode?: RunRecord["mode"] | null) {
  if (isPlanningRunMode(runMode)) {
    return t("conversation.activity.startPlanningAgent");
  }

  const workerLabel = typeof worker.workerNumber === "number"
    ? `worker ${worker.workerNumber}`
    : formatConversationWorkerLabel(worker.id);
  const task = summarizeTaskText(worker.title || worker.initialPrompt || "");

  return task
    ? `Starting ${workerLabel} to ${lowerFirst(task)}`
    : `Starting ${workerLabel}.`;
}

function summarizeSupervisorIntervention(intervention: SupervisorInterventionRecord) {
  const workerLabel = formatConversationWorkerLabel(intervention.workerId);
  const prompt = summarizeTaskText(intervention.prompt);
  if (!prompt) {
    return `Steering ${workerLabel}.`;
  }

  if (intervention.interventionType === "recovery") {
    return `Steering ${workerLabel} to recover: ${prompt}`;
  }

  if (intervention.interventionType === "completion_gap") {
    return `Steering ${workerLabel} to close the remaining gap: ${prompt}`;
  }

  return `Steering ${workerLabel}: ${prompt}`;
}

function normalizeDetailText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatDetailLabel(key: string) {
  const explicitLabels: Record<string, string> = {
    cancelError: "Cancel error",
    currentText: "Current",
    lastText: "Last",
    text: "Text",
    projectPath: "Project",
    resolvedWorkerCwd: "Resolved cwd",
    stopReason: "Stop reason",
    workerCwd: "Worker cwd",
  };

  if (explicitLabels[key]) {
    return explicitLabels[key];
  }

  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (first) => first.toUpperCase());
}

function stringifyDetailValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

export function getExecutionEventDetailRows(event: ExecutionEventRecord) {
  const details = parseExecutionEventDetails(event.details);
  const summary = summarizeExecutionEvent(event);
  const summaryDetail = typeof details.summary === "string" ? normalizeDetailText(details.summary) : "";
  const seenValues = new Set([normalizeDetailText(summary), summaryDetail].filter(Boolean));
  const rows: Array<{ key: string; label: string; value: string; multiline: boolean }> = [];

  for (const [key, rawValue] of Object.entries(details)) {
    if (key === "summary") {
      continue;
    }

    const value = stringifyDetailValue(rawValue);
    if (!value) {
      continue;
    }

    const normalizedValue = normalizeDetailText(value);
    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    rows.push({
      key,
      label: formatDetailLabel(key),
      value: normalizedValue.length > 360 ? `${normalizedValue.slice(0, 360)}...` : value,
      multiline: value.includes("\n") || value.length > 120 || typeof rawValue === "object",
    });
  }

  return rows;
}

function extractSupervisorReadPath(details: Record<string, unknown>, summary: string) {
  const candidateKeys = ["path", "requestedPath", "filePath", "absolutePath"];
  for (const key of candidateKeys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const summaryMatch = summary.match(/^Read\s+(.+?)(?:\s+for\b|$)/i);
  return summaryMatch?.[1]?.trim() ?? "";
}

export function summarizeExecutionEvent(event: ExecutionEventRecord) {
  const details = parseExecutionEventDetails(event.details);
  const summary = typeof details.summary === "string" ? details.summary.trim() : "";
  const reason = typeof details.reason === "string" ? details.reason.trim() : "";
  const error = typeof details.error === "string" ? details.error.trim() : "";
  const seconds = typeof details.seconds === "number" ? details.seconds : null;
  const mode = typeof details.mode === "string" ? details.mode.trim() : "";
  const workerLabel = formatExecutionWorkerLabel(event.workerId);

  if (event.eventType === "supervisor_file_read") {
    const readPath = extractSupervisorReadPath(details, summary);
    return readPath ? `Read ${readPath}` : "Read file";
  }

  if (event.eventType === "supervisor_turn_stopped") {
    return summary || "Supervisor delayed a repeated tool request";
  }

  if (event.eventType === "supervisor_wait") {
    const waitReason = summary || reason || "Waiting before the next supervisor check";
    return seconds ? `Waiting ${seconds}s: ${waitReason}` : waitReason;
  }

  if (event.eventType === "run_failed") {
    return `Run failed${reason || summary || error ? `: ${reason || summary || error}` : ""}`;
  }

  if (event.eventType === "run_completed") {
    return `Completed${summary ? `: ${summary}` : ""}`;
  }

  if (event.eventType === "auto_commit_created") {
    const shortSha = typeof details.shortSha === "string" ? details.shortSha : "";
    const subject = typeof details.subject === "string" ? details.subject : "";
    return t("commit.status.autoCommitCreated", { commit: [shortSha, subject].filter(Boolean).join(" ") });
  }

  if (event.eventType === "auto_commit_skipped") {
    return t("commit.status.autoCommitSkipped", { reason: reason || summary || "skipped" });
  }

  if (event.eventType === "auto_commit_failed") {
    return t("commit.status.autoCommitFailed", { reason: reason || summary || error || "failed" });
  }

  if (event.eventType === "auto_commit_push_created") {
    const shortSha = typeof details.shortSha === "string" ? details.shortSha : "";
    return t("commit.status.pushCreated", { commit: shortSha });
  }

  if (event.eventType === "auto_commit_push_failed") {
    return t("commit.status.pushFailed", { reason: error || summary || "failed" });
  }

  if (event.eventType === "worker_prompt_failed") {
    return `Failed to send task to ${workerLabel}${error ? `: ${error}` : ""}`;
  }

  if (event.eventType === "worker_prompt_deferred") {
    return `Waiting to steer ${formatConversationWorkerLabel(event.workerId)}; worker is busy.`;
  }

  if (event.eventType === "worker_environment_mismatch") {
    return `${workerLabel} launched in the wrong directory`;
  }

  if (event.eventType === "worker_spawned") {
    return `Started ${workerLabel}`;
  }

  if (event.eventType === "worker_prompted") {
    return `Sent task to ${workerLabel}`;
  }

  if (event.eventType === "worker_mode_changed") {
    return `Changed ${workerLabel} to ${mode || "requested"} mode`;
  }

  if (event.eventType === "worker_permission_requested") {
    return `${workerLabel} requested permission`;
  }

  if (event.eventType === "worker_permission_approved") {
    return `Approved permission for ${workerLabel}`;
  }

  if (event.eventType === "worker_permission_auto_approved") {
    return `Auto-approved permission for ${workerLabel}`;
  }

  if (event.eventType === "worker_session_resumed") {
    return `Resumed ${workerLabel} from saved session`;
  }

  if (event.eventType === "worker_session_missing") {
    return `${workerLabel} session is no longer available`;
  }

  if (event.eventType === "worker_permission_denied") {
    return `Denied permission for ${workerLabel}`;
  }

  if (event.eventType === "worker_cancelled") {
    return `Cancelled ${workerLabel}`;
  }

  if (event.eventType === "worker_output_changed") {
    return `${workerLabel} produced new output`;
  }

  if (event.eventType === "worker_turn_completed") {
    return `${workerLabel} completed a turn`;
  }

  if (event.eventType === "worker_idle") {
    return `${workerLabel} is waiting`;
  }

  if (event.eventType === "worker_stuck") {
    return `${workerLabel} appears stuck`;
  }

  if (event.eventType === "worker_error") {
    return `${workerLabel} reported an error`;
  }

  if (event.eventType === "worker_stopped") {
    return `${workerLabel} stopped`;
  }

  if (event.eventType === "worker_failover_started") {
    const outgoingType = typeof details.outgoingType === "string" ? details.outgoingType : "";
    const newType = typeof details.newType === "string" ? details.newType : "";
    return t("events.failover.started", {
      outgoing: outgoingType || workerLabel,
      incoming: newType || "next worker",
    });
  }

  if (event.eventType === "worker_handoff_emitted") {
    const source = typeof details.source === "string" ? details.source : "";
    const key = source === "synthetic" ? "events.failover.handoffSynthetic" : "events.failover.handoffEmitted";
    return t(key, { outgoing: workerLabel });
  }

  if (event.eventType === "worker_failover_completed") {
    const outgoingType = typeof details.outgoingType === "string" ? details.outgoingType : "";
    const newType = typeof details.newType === "string" ? details.newType : "";
    return t("events.failover.completed", {
      outgoing: outgoingType || workerLabel,
      incoming: newType || "next worker",
    });
  }

  if (event.eventType === "clarification_requested") {
    return "Waiting for your reply";
  }

  return summary || reason || error || event.eventType.replace(/_/g, " ");
}

export function summarizeInlineEvent(event: ExecutionEventRecord) {
  if (classifyExecutionEvent(event) !== "inline_event") {
    return null;
  }

  if (event.eventType === "worker_spawned") {
    return summarizeWorkerSpawnEvent(event);
  }

  return summarizeExecutionEvent(event);
}

export function formatExecutionTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function parseTimestampMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getRunDurationLabel(run: RunRecord | null, completedAt?: string | null, now = Date.now()) {
  if (!run) {
    return null;
  }

  const startedAt = parseTimestampMs(run.createdAt);
  if (startedAt === null) {
    return null;
  }

  const status = run.status.trim().toLowerCase();
  const endCandidate = status === "done"
    ? completedAt || run.updatedAt
    : status === "failed"
      ? run.failedAt || run.updatedAt
      : null;
  const endedAt = parseTimestampMs(endCandidate) ?? (status === "done" || status === "failed" ? parseTimestampMs(run.updatedAt) : null) ?? now;
  const duration = formatHumanDuration(Math.max(0, endedAt - startedAt));

  if (status === "done") {
    return `Completed in ${duration}`;
  }

  if (status === "failed") {
    return `Failed after ${duration}`;
  }

  if (status === "awaiting_user") {
    return `Waiting after ${duration}`;
  }

  return `Running for ${duration}`;
}

export function describeAgentActivity(agent: AgentSnapshot) {
  if ((agent.pendingPermissions?.length ?? 0) > 0) {
    return `${agent.name}: waiting for permission`;
  }

  if (agent.state === "starting") {
    return `${agent.name}: connecting to agent runtime`;
  }

  if (agent.state === "working" && agent.currentText?.trim()) {
    return `${agent.name}: ${summarizeThought(agent.currentText)}`;
  }

  if (agent.state === "working") {
    return `${agent.name}: waiting for LLM API`;
  }

  if (agent.state === "error") {
    return `${agent.name}: ${agent.lastError || agent.stopReason || "worker error"}`;
  }

  if (agent.state === "stopped") {
    return `${agent.name}: stopped${agent.stopReason ? ` (${agent.stopReason})` : ""}`;
  }

  if (agent.state === "idle") {
    return `${agent.name}: waiting for more work`;
  }

  return `${agent.name}: ${agent.state}`;
}

export function resolveSelectedWorkerModel(workerType: WorkerType, selectedModel: string) {
  const normalized = selectedModel.trim();
  if (!normalized) {
    return normalized;
  }

  const normalizedLower = normalized.toLowerCase();
  if (workerType === "opencode") {
    if (selectedModel === "GPT-5.4" || normalizedLower === "gpt-5.4") return "openai/gpt-5.4";
    if (selectedModel === "GPT-5.4 Mini" || normalizedLower === "gpt-5.4-mini") return "openai/gpt-5.4-mini";
    if (selectedModel === "GPT-5.3 Codex" || normalizedLower === "gpt-5.3-codex") return "openai/gpt-5.3-codex";
    if (selectedModel === "Claude Sonnet 4" || normalizedLower === "claude-sonnet-4") return "anthropic/claude-sonnet-4";
  }

  if (workerType === "codex") {
    if (selectedModel === "GPT-5.4" || normalizedLower === "openai/gpt-5.4") return "gpt-5.4";
    if (selectedModel === "GPT-5.4 Mini" || normalizedLower === "openai/gpt-5.4-mini") return "gpt-5.4-mini";
    if (selectedModel === "GPT-5.3 Codex" || normalizedLower === "openai/gpt-5.3-codex") return "gpt-5.3-codex";
    if (selectedModel === "Claude Sonnet 4" || normalizedLower === "anthropic/claude-sonnet-4") return "claude-sonnet-4";
  }

  return normalized;
}

export function resolveComposerModelValue(preferredModel: string | null | undefined) {
  if (!preferredModel?.trim()) {
    return null;
  }

  const normalized = preferredModel.trim().toLowerCase();
  if (normalized === "gpt-5.4" || normalized === "openai/gpt-5.4") {
    return preferredModel.includes("/") ? "openai/gpt-5.4" : "gpt-5.4";
  }
  if (normalized === "gpt-5.4-mini" || normalized === "openai/gpt-5.4-mini") {
    return preferredModel.includes("/") ? "openai/gpt-5.4-mini" : "gpt-5.4-mini";
  }
  if (normalized === "claude-sonnet-4" || normalized === "anthropic/claude-sonnet-4") {
    return preferredModel.includes("/") ? "anthropic/claude-sonnet-4" : "claude-sonnet-4";
  }

  return preferredModel.trim();
}

export function getWorkerModelOptions(catalog: Partial<WorkerModelCatalog> | undefined, workerType: WorkerType) {
  const discoveredModels = catalog?.[workerType];
  return discoveredModels?.length ? discoveredModels : FALLBACK_WORKER_MODEL_OPTIONS[workerType];
}

export function resolveComposerEffortLabel(preferredEffort: string | null | undefined) {
  if (!preferredEffort?.trim()) {
    return null;
  }

  const normalized = preferredEffort.trim().toLowerCase();
  if (normalized === "low") {
    return "Low";
  }
  if (normalized === "medium") {
    return "Medium";
  }
  if (normalized === "high") {
    return "High";
  }

  return null;
}

export function buildConversationPath(selectedRunId: string | null, draftProjectPath: string | null) {
  if (selectedRunId) {
    return `/session/${selectedRunId}`;
  }

  const params = new URLSearchParams();
  if (draftProjectPath) {
    params.set("project", draftProjectPath);
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function createClientRunId() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

export function resolveRepoName(projectPath: string | null): string {
  const normalized = projectPath?.trim().replace(/[/\\]+$/, "");
  if (!normalized) return "omniharness";
  return normalized.split(/[/\\]/).filter(Boolean).pop() || "omniharness";
}
