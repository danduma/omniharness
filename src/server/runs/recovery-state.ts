export type RecoveryStateKind =
  | "healthy"
  | "recovering"
  | "lost_worker_resumable"
  | "lost_worker_rerunnable"
  | "quota_waiting"
  | "needs_recovery"
  | "queue_blocked"
  | "unrecoverable";

export type RecoveryRecommendedAction =
  | "none"
  | "resume_session"
  | "restart_from_checkpoint"
  | "wait_for_quota_reset"
  | "manual_resume"
  | "inspect_error";

export type RecoveryState = {
  kind: RecoveryStateKind;
  status: "none" | "open" | "recovering" | "needs_user" | "failed";
  message: string;
  recommendedAction: RecoveryRecommendedAction;
  workerId?: string | null;
  queuedMessageId?: string | null;
  sessionId?: string | null;
  reason?: string | null;
  resumeAt?: string | null;
  quotaResetSource?: string | null;
  quotaResetConfidence?: string | null;
};

export type RecoveryRunLike = {
  id: string;
  mode?: string | null;
  status: string;
  quotaResumeAt?: Date | string | null;
  quotaResetSource?: string | null;
  quotaResetConfidence?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type RecoveryWorkerLike = {
  id: string;
  runId: string;
  status: string;
  bridgeSessionId?: string | null;
  updatedAt?: Date | string | null;
};

export type RecoveryLiveAgentLike = {
  name: string;
  state?: string | null;
  currentText?: string | null;
  sessionId?: string | null;
};

export type RecoveryMessageLike = {
  id: string;
  runId: string;
  role: string;
  createdAt?: Date | string | null;
};

export type RecoveryQueuedMessageLike = {
  id: string;
  runId: string;
  targetWorkerId?: string | null;
  status: string;
  lastError?: string | null;
};

const TERMINAL_RUN_STATUSES = new Set(["done", "failed", "cancelled", "canceled"]);
const ACTIVE_WORKER_STATUSES = new Set(["starting", "working", "idle", "stuck", "recovering"]);
const STARTING_WORKER_GRACE_MS = 30_000;
const ACTIVE_WORKER_GRACE_MS = 15_000;

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function timestampMs(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isRecoverableAgentMissingError(value: string | null | undefined) {
  return /\b(agent not found|not_found|session not found|invalid session identifier|failed to load resumed session data from file|404)\b/i.test(value ?? "");
}

function isActivePersistedWorker(worker: RecoveryWorkerLike, nowMs: number) {
  const status = normalizeStatus(worker.status);
  if (!ACTIVE_WORKER_STATUSES.has(status)) {
    return false;
  }

  const updatedAt = timestampMs(worker.updatedAt);
  if (status === "starting") {
    return updatedAt === null || nowMs - updatedAt >= STARTING_WORKER_GRACE_MS;
  }

  // Worker rows can flip to working/idle/recovering a beat before the bridge's
  // liveAgents snapshot reflects them. Apply a short grace window so a freshly
  // transitioned worker isn't classified as lost on the next reconcile tick.
  if (updatedAt !== null && nowMs - updatedAt < ACTIVE_WORKER_GRACE_MS) {
    return false;
  }

  return true;
}

function latestUserCheckpoint(messages: RecoveryMessageLike[]) {
  return messages
    .filter((message) => message.role === "user")
    .sort((a, b) => {
      const aTime = timestampMs(a.createdAt) ?? 0;
      const bTime = timestampMs(b.createdAt) ?? 0;
      return bTime - aTime;
    })[0] ?? null;
}

function findQueueBlockedMessage(
  queuedMessages: RecoveryQueuedMessageLike[],
  workerId?: string | null,
) {
  return queuedMessages.find((message) => (
    message.status === "failed"
    && isRecoverableAgentMissingError(message.lastError)
    && (!workerId || !message.targetWorkerId || message.targetWorkerId === workerId)
  )) ?? null;
}

export function classifyRunRecoveryState({
  run,
  workers,
  liveAgents,
  messages = [],
  queuedMessages = [],
  nowMs = Date.now(),
}: {
  run: RecoveryRunLike;
  workers: RecoveryWorkerLike[];
  liveAgents: RecoveryLiveAgentLike[];
  messages?: RecoveryMessageLike[];
  queuedMessages?: RecoveryQueuedMessageLike[];
  nowMs?: number;
}): RecoveryState {
  const runStatus = normalizeStatus(run.status);
  if (runStatus === "recovering") {
    return {
      kind: "recovering",
      status: "recovering",
      message: "Recovery is already in progress.",
      recommendedAction: "none",
    };
  }

  if (runStatus === "needs_recovery") {
    return {
      kind: "needs_recovery",
      status: "needs_user",
      message: "This run needs manual recovery before it can continue.",
      recommendedAction: "manual_resume",
    };
  }

  if (runStatus === "quota_waiting") {
    const resumeAt = run.quotaResumeAt instanceof Date
      ? run.quotaResumeAt.toISOString()
      : run.quotaResumeAt ?? null;
    return {
      kind: "quota_waiting",
      status: "open",
      message: "Waiting for quota reset before resuming.",
      recommendedAction: "wait_for_quota_reset",
      resumeAt,
      quotaResetSource: run.quotaResetSource ?? null,
      quotaResetConfidence: run.quotaResetConfidence ?? null,
    };
  }

  if (TERMINAL_RUN_STATUSES.has(runStatus)) {
    return {
      kind: "healthy",
      status: "none",
      message: "Run is terminal.",
      recommendedAction: "none",
    };
  }

  const liveAgentNames = new Set(liveAgents.map((agent) => agent.name));
  const runWorkers = workers.filter((worker) => worker.runId === run.id);
  const blockedMessage = findQueueBlockedMessage(queuedMessages);

  for (const worker of runWorkers) {
    if (!isActivePersistedWorker(worker, nowMs) || liveAgentNames.has(worker.id)) {
      continue;
    }

    const workerBlockedMessage = findQueueBlockedMessage(queuedMessages, worker.id);
    const sessionId = worker.bridgeSessionId?.trim() || null;
    if (sessionId) {
      return {
        kind: "lost_worker_resumable",
        status: "open",
        message: "The worker is missing from the runtime, but a saved session can be resumed.",
        recommendedAction: "resume_session",
        workerId: worker.id,
        queuedMessageId: workerBlockedMessage?.id ?? null,
        sessionId,
      };
    }

    if (run.mode === "implementation" && latestUserCheckpoint(messages)) {
      return {
        kind: "lost_worker_rerunnable",
        status: "open",
        message: "The worker is missing from the runtime. Restart from the latest checkpoint.",
        recommendedAction: "restart_from_checkpoint",
        workerId: worker.id,
        queuedMessageId: workerBlockedMessage?.id ?? null,
        reason: workerBlockedMessage?.lastError ?? "Worker was marked active but is not present in the bridge runtime.",
      };
    }

    return {
      kind: "needs_recovery",
      status: "needs_user",
      message: "The worker is missing from the runtime and needs manual recovery.",
      recommendedAction: "manual_resume",
      workerId: worker.id,
      queuedMessageId: workerBlockedMessage?.id ?? null,
      reason: workerBlockedMessage?.lastError ?? "Worker was marked active but is not present in the bridge runtime.",
    };
  }

  if (blockedMessage && run.mode !== "implementation") {
    return {
      kind: "queue_blocked",
      status: "needs_user",
      message: "A queued message could not be delivered because its worker is missing.",
      recommendedAction: "manual_resume",
      workerId: blockedMessage.targetWorkerId,
      queuedMessageId: blockedMessage.id,
      reason: blockedMessage.lastError,
    };
  }

  if (blockedMessage && run.mode === "implementation" && latestUserCheckpoint(messages)) {
    return {
      kind: "lost_worker_rerunnable",
      status: "open",
      message: "A queued message is blocked on a missing worker. Restart from the latest checkpoint.",
      recommendedAction: "restart_from_checkpoint",
      workerId: blockedMessage.targetWorkerId,
      queuedMessageId: blockedMessage.id,
      reason: blockedMessage.lastError,
    };
  }

  return {
    kind: "healthy",
    status: "none",
    message: "Run has no recovery issue.",
    recommendedAction: "none",
  };
}
