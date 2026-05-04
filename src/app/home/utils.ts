import { type AppErrorDescriptor, normalizeAppError } from "@/lib/app-errors";
import { formatHumanDuration } from "@/lib/conversation-workers";
import { WORKER_OPTIONS, FALLBACK_WORKER_MODEL_OPTIONS } from "./constants";
import type { AgentSnapshot, EventStreamState, ExecutionEventRecord, MessageRecord, PlanItemRecord, PlanRecord, RunRecord, WorkerModelCatalog, WorkerType } from "./types";

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
    validationRuns: (current.validationRuns || []).filter((item: { runId: string }) => item.runId !== runId),
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
  };
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

const PENDING_CREATED_CONVERSATION_STABLE_MS = 10_000;

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

  for (const [runId, snapshot] of Array.from(pendingSnapshots.entries())) {
    if (isCreatedConversationSnapshotServerVisible(incomingState, snapshot)) {
      snapshot.serverVisibleAtMs ??= nowMs;
      if (nowMs - snapshot.serverVisibleAtMs >= PENDING_CREATED_CONVERSATION_STABLE_MS) {
        pendingSnapshots.delete(runId);
      }
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
  | { type: "activity"; id: string; createdAt: string; event: ExecutionEventRecord; text: string };

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
  "supervisor_context_compacted",
  "supervisor_repo_inspected",
  "supervisor_wait",
  "worker_idle",
  "worker_mode_changed",
  "worker_output_changed",
  "worker_permission_auto_approved",
  "worker_prompted",
  "worker_session_resumed",
  "worker_snapshot_invalid",
  "worker_stopped",
]);

const DYNAMIC_STATUS_EVENT_TYPES = new Set([
  "worker_prompt_deferred",
  "worker_spawned",
  "worker_stuck",
]);

const INLINE_CONVERSATION_EVENT_TYPES = new Set([
  "clarification_requested",
  "run_failed",
  "run_validation_failed",
  "supervisor_file_read",
  "worker_cancelled",
  "worker_error",
  "worker_permission_approved",
  "worker_permission_denied",
  "worker_permission_requested",
  "worker_prompt_failed",
  "worker_environment_mismatch",
  "worker_session_missing",
  "worker_spawn_blocked",
]);

const MESSAGE_MIRRORED_CONVERSATION_TIMELINE_EVENT_TYPES = new Set([
  "clarification_requested",
  "run_completed",
  "worker_cancelled",
  "worker_permission_approved",
  "worker_permission_denied",
  "worker_spawn_blocked",
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
}: {
  messages: MessageRecord[];
  executionEvents: ExecutionEventRecord[];
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

  for (const event of sortedExecutionEvents) {
    if (!shouldShowExecutionEventInTimeline(event, messages)) {
      continue;
    }

    const text = summarizeInlineEvent(event)?.trim() ?? "";
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
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

function normalizeDetailText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatDetailLabel(key: string) {
  const explicitLabels: Record<string, string> = {
    cancelError: "Cancel error",
    currentText: "Current",
    lastText: "Last",
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

export function summarizeExecutionEvent(event: ExecutionEventRecord) {
  const details = parseExecutionEventDetails(event.details);
  const summary = typeof details.summary === "string" ? details.summary.trim() : "";
  const reason = typeof details.reason === "string" ? details.reason.trim() : "";
  const error = typeof details.error === "string" ? details.error.trim() : "";
  const seconds = typeof details.seconds === "number" ? details.seconds : null;
  const mode = typeof details.mode === "string" ? details.mode.trim() : "";
  const workerLabel = formatExecutionWorkerLabel(event.workerId);

  if (event.eventType === "supervisor_file_read") {
    const path = typeof details.path === "string" && details.path.trim()
      ? details.path.trim()
      : typeof details.absolutePath === "string" && details.absolutePath.trim()
        ? details.absolutePath.trim()
        : "";
    return path ? `Read ${path}` : "Read file";
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

  if (event.eventType === "worker_prompt_failed") {
    return `Failed to send task to ${workerLabel}${error ? `: ${error}` : ""}`;
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

  if (event.eventType === "clarification_requested") {
    return "Waiting for your reply";
  }

  return summary || reason || error || event.eventType.replace(/_/g, " ");
}

export function summarizeInlineEvent(event: ExecutionEventRecord) {
  if (classifyExecutionEvent(event) !== "inline_event") {
    return null;
  }

  return summarizeExecutionEvent(event);
}

export function formatExecutionTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
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
