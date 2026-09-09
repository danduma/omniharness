import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { messages, queuedConversationMessages, recoveryIncidents, runs, workers } from "@/server/db/schema";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { refreshDerivedGoalPlan } from "@/server/runs/goal-plan-derivation";
import { listAgents, normalizeAgentRecord, type AgentRecord } from "@/server/bridge-client";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { listExecutionEventsForWorker, recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { persistRunFailure } from "@/server/runs/failures";
import { isTerminalRunStatus } from "@/server/runs/status";
import { isLongWorkerCompletionText } from "@/server/supervisor/worker-completion";
import { startSupervisorRun } from "@/server/supervisor/start";
import { isRecoverableConnectionSupervisorError, isTransientSupervisorError } from "@/server/supervisor/retry";
import {
  readWorkerOutputEntries,
  withWorkerOutputWriteFence,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import {
  isUnsettledRecoveryIncidentStatus,
  resolveRecoveryIncidentsDisprovedByActiveWork,
} from "@/server/runs/recovery-incidents";
import {
  annotateVerifiedDeadCredential,
  annotateVerifiedLiveCredential,
  hasVerifiedDeadCredentialMarker,
  hasVerifiedLiveCredentialMarker,
  isAuthShapedProviderFailure,
  readVerifiedDeadCredentialAccountId,
} from "@/lib/provider-account-failures";
import { markAccountLoginRequired } from "@/server/accounts/login-required";
import { drainQueuedWorkerMessages } from "./queued-messages";
import { trackConversationBackgroundTask } from "./worker-turn-gate";
import {
  resolveDirectRunStatusFromWorkerOutput,
  updateDirectRunStatusFromWorkerOutput,
} from "./direct-run-status";

const EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output.";
const MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";

function isDirectRunMode(mode: string | null | undefined) {
  return mode === "direct" || mode === "commit";
}

/**
 * Bridge snapshots only know the provider's raw error. The run record may know
 * more because the control plane independently probed the credential after
 * that error. Never let a later snapshot downgrade that verified verdict back
 * to unverified text: the marker drives both retry safety and the re-login UI.
 */
async function resolveSyncedFailureMessage(
  runId: string,
  workerId: string,
  workerType: string,
  persistedError: string | null,
  bridgeError: string | null | undefined,
) {
  const incoming = bridgeError?.trim();
  if (!incoming) return persistedError;
  const persistedDead = hasVerifiedDeadCredentialMarker(persistedError);
  const persistedLive = hasVerifiedLiveCredentialMarker(persistedError);
  if (!isAuthShapedProviderFailure(incoming)) {
    if (persistedDead) {
      return annotateVerifiedDeadCredential(incoming, readVerifiedDeadCredentialAccountId(persistedError));
    }
    return persistedLive ? annotateVerifiedLiveCredential(incoming) : incoming;
  }
  if (persistedDead || persistedLive) {
    return persistedError;
  }

  // Versions before the durable-marker fix may already have overwritten the
  // run with raw provider text. The independent probe result still exists in
  // the append-only execution stream, so use it to self-heal on the next sync.
  const verificationEvents = await listExecutionEventsForWorker(workerId, 25);
  for (const event of verificationEvents) {
    if (event.eventType !== "worker_credential_verified" || !event.details) continue;
    let details: { accountId?: unknown; liveness?: unknown; detail?: unknown };
    try {
      details = JSON.parse(event.details) as typeof details;
    } catch {
      continue;
    }
    if (details.liveness !== "dead" && details.liveness !== "live") continue;

    const accountId = typeof details.accountId === "string" && details.accountId.trim()
      ? details.accountId.trim()
      : null;
    const reason = typeof details.detail === "string" ? details.detail : incoming;
    const verdict = details.liveness;
    if (verdict === "dead" && accountId) {
      await markAccountLoginRequired({
        accountId,
        workerType,
        reason,
        source: "restart_credential_verdict_repair",
      });
    }
    emitNamedEvent({
      kind: "account.credential_verdict_recovered",
      accountId: accountId ?? "default",
      runId,
      workerId,
      workerType,
      verdict,
      source: "execution_event",
    });
    if (verdict === "dead") {
      emitNamedEvent({
        kind: "account.login_required",
        accountId: accountId ?? "default",
        workerType,
        reason,
      });
      return annotateVerifiedDeadCredential(incoming, accountId);
    }
    return annotateVerifiedLiveCredential(incoming);
  }
  return incoming;
}

/**
 * Entry types the worker itself authors while doing a turn.
 *
 * Everything else in the stream exists before the worker has done anything:
 * the user's own prompt (`user_input`), the spawn/lifecycle notes the server
 * writes, and the session handshake the bridge replays as soon as an ACP
 * session exists (`current_mode`, `config_option`, `available_commands`,
 * `session_info`). `usage` is accounting, not work.
 */
const WORKER_PRODUCED_ENTRY_TYPES = new Set([
  "message",
  "thought",
  "tool_call",
  "tool_call_update",
  "permission",
  "elicitation",
  "plan",
  "plan_update",
  "plan_removed",
  "agent_content",
]);

function isWorkerProducedEntry(entry: { type?: string | null; text?: string | null }) {
  return WORKER_PRODUCED_ENTRY_TYPES.has(entry.type ?? "") && Boolean(entry.text?.trim());
}

/**
 * Has this worker produced anything of its own?
 *
 * Deliberately not "is the stream non-empty". A direct conversation persists
 * the user's prompt and the spawn lifecycle notes *before* the turn starts, and
 * the bridge registers the agent as `idle` in the gap between creating the ACP
 * session and accepting the prompt. Counting those entries as output made an
 * idle-because-not-started worker indistinguishable from an idle-because-
 * finished one, so `resolveSyncedRunState` marked brand-new runs `done` one or
 * two seconds after creation — and once a direct run is terminal the sync below
 * skips it, so it never came back to `running` for the four minutes it then
 * spent actually working.
 */
function hasAgentOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
  return Boolean(
    agent.renderedOutput?.trim()
    || agent.currentText.trim()
    || agent.lastText.trim()
    || agent.outputEntries?.some(isWorkerProducedEntry),
  );
}

function normalizedStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function isCompletedEntryStatus(value: string | null | undefined) {
  const status = normalizedStatus(value);
  return !status || [
    "approved",
    "cancelled",
    "canceled",
    "completed",
    "denied",
    "error",
    "failed",
    "success",
  ].includes(status);
}

function isInputEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
  const type = (entry as { type?: string | null }).type;
  return type === "user_input" || type === "supervisor_input";
}

function isOpenWorkEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
  if (entry.type !== "tool_call" && entry.type !== "tool_call_update" && entry.type !== "permission" && entry.type !== "elicitation") {
    return false;
  }

  return !isCompletedEntryStatus(entry.status);
}

function hasPendingElicitationSignal(snapshot: ReturnType<typeof normalizeAgentRecord> | null) {
  return Boolean(
    (snapshot?.pendingElicitations?.length ?? 0) > 0
    || snapshot?.outputEntries?.some((entry) => entry.type === "elicitation" && !isCompletedEntryStatus(entry.status)),
  );
}

function directLiveAgentHasCompletedTurn(agent: ReturnType<typeof normalizeAgentRecord>) {
  const state = normalizedStatus(agent.state);
  if (state !== "working" && state !== "starting" && state !== "stuck") {
    return false;
  }

  if (!agent.stopReason?.trim() && !isLongWorkerCompletionText(agent.currentText || agent.lastText || agent.renderedOutput)) {
    return false;
  }

  if ((agent.pendingPermissions?.length ?? 0) > 0) {
    return false;
  }

  if ((agent.pendingElicitations?.length ?? 0) > 0) {
    return false;
  }

  const entries = agent.outputEntries ?? [];
  if (entries.length === 0) {
    return false;
  }

  const lastInputIndex = entries.findLastIndex(isInputEntry);
  const turnEntries = entries.slice(lastInputIndex + 1);
  if (turnEntries.some(isOpenWorkEntry)) {
    return false;
  }

  const currentText = agent.currentText.trim();
  const lastText = agent.lastText.trim();
  if (currentText && lastText && currentText !== lastText) {
    return false;
  }

  const latestMeaningfulEntry = [...turnEntries].reverse().find((entry) => (
    entry.status !== "archived"
    && entry.text.trim().length > 0
  ));

  return latestMeaningfulEntry?.type === "message";
}

/**
 * Is there anything at all in this worker's stream?
 *
 * Used only to spot a worker that went idle having written literally nothing,
 * which is a runtime failure worth surfacing. It deliberately counts the user's
 * prompt and the lifecycle notes: if even those are missing, the stream is
 * broken rather than merely unstarted.
 */
async function hasPersistedWorkerStreamContent(worker: typeof workers.$inferSelect) {
  if (
    worker.outputLog.trim()
    || worker.currentText.trim()
    || worker.lastText.trim()
  ) {
    return true;
  }

  const entries = await readWorkerOutputEntries(worker.runId, worker.id);
  return entries.some((entry) => {
    const text = (entry as { text?: unknown }).text;
    return typeof text === "string" && text.trim().length > 0;
  });
}

/** Persisted twin of `hasAgentOutput`. See the note there for why input and handshake entries do not count. */
async function hasPersistedWorkerOutput(worker: typeof workers.$inferSelect) {
  if (
    worker.outputLog.trim()
    || worker.currentText.trim()
    || worker.lastText.trim()
  ) {
    return true;
  }

  const entries = await readWorkerOutputEntries(worker.runId, worker.id);
  return entries.some((entry) => isWorkerProducedEntry(entry as { type?: string | null; text?: string | null }));
}

function resolveSyncedRunState(run: typeof runs.$inferSelect, agent: ReturnType<typeof normalizeAgentRecord>) {
  if (agent.state === "error") {
    return "failed";
  }

  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...agent, workerStatus: agent.state }) === "awaiting_user") {
    return "awaiting_user";
  }

  if (isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent)) {
    return "done";
  }

  if (isDirectRunMode(run.mode) && agent.state === "idle" && hasAgentOutput(agent)) {
    return "done";
  }

  if (
    ["stopped", "cancelled", "done", "completed"].includes(agent.state)
    || (agent.state === "idle" && agent.stopReason === "end_turn" && hasAgentOutput(agent))
  ) {
    return "done";
  }

  return "running";
}

async function resolvePersistedRunState(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
  const status = normalizedStatus(worker.status);

  if (status === "error") {
    return "failed";
  }

  if (status === "lost") {
    return "needs_recovery";
  }

  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...worker, workerStatus: worker.status }) === "awaiting_user") {
    return "awaiting_user";
  }

  if (
    ["stopped", "cancelled", "done", "completed"].includes(status)
    || (status === "idle" && await hasPersistedWorkerOutput(worker))
  ) {
    return "done";
  }

  return "running";
}

async function isEmptyIdlePersistedWorker(worker: typeof workers.$inferSelect) {
  const status = normalizedStatus(worker.status);
  return status === "idle" && !(await hasPersistedWorkerStreamContent(worker));
}

/** Live twin of `hasPersistedWorkerStreamContent`: anything at all in the stream. */
function hasAgentStreamContent(agent: ReturnType<typeof normalizeAgentRecord>) {
  return Boolean(
    agent.renderedOutput?.trim()
    || agent.currentText.trim()
    || agent.lastText.trim()
    || agent.outputEntries?.some((entry) => entry.text.trim()),
  );
}

function isIdleLiveAgentWithoutOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
  return agent.state === "idle" && !hasAgentStreamContent(agent);
}

function isAgentBusyRunFailure(run: typeof runs.$inferSelect) {
  return run.status === "failed" && /\bagent is busy\b/i.test(run.lastError ?? "");
}

function isRecoverableImplementationTransientFailure(run: typeof runs.$inferSelect) {
  const lastError = run.lastError ?? "";
  return run.mode === "implementation"
    && run.status === "failed"
    && Boolean(lastError.trim())
    && isTransientSupervisorError(new Error(lastError));
}

function isRecoverableImplementationConnectionFailure(run: typeof runs.$inferSelect) {
  const lastError = run.lastError ?? "";
  return run.mode === "implementation"
    && run.status === "failed"
    && Boolean(lastError.trim())
    && isRecoverableConnectionSupervisorError(new Error(lastError));
}

function isCleanLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
  return agent.state !== "error" && !agent.lastError?.trim();
}

function isActiveLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
  const state = normalizedStatus(agent.state);
  return ["starting", "working", "stuck"].includes(state) || Boolean(agent.currentText.trim());
}

function isWorkerQueueDrainableStatus(status: string) {
  const normalized = normalizedStatus(status);
  return Boolean(normalized) && !["starting", "working", "stuck", "error", "cancelled"].includes(normalized);
}

async function pendingWorkerQueueCount(runId: string, workerId: string) {
  const records = await db.select({ id: queuedConversationMessages.id })
    .from(queuedConversationMessages)
    .where(and(
      eq(queuedConversationMessages.runId, runId),
      eq(queuedConversationMessages.targetWorkerId, workerId),
      eq(queuedConversationMessages.status, "pending"),
    ));
  return records.length;
}

async function recordQueueDrainDecision(args: {
  runId: string;
  workerId: string;
  source: string;
  workerStatus: string;
  pendingCount: number;
  decision: "drain" | "skip";
  reason: string;
}) {
  emitNamedEvent({
    kind: "queue.drain_decision",
    runId: args.runId,
    workerId: args.workerId,
    source: args.source,
    workerStatus: args.workerStatus,
    pendingCount: args.pendingCount,
    decision: args.decision,
    reason: args.reason,
  });
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    eventType: "queue_drain_decision",
    details: {
      summary: args.decision === "drain"
        ? `Draining ${args.pendingCount} queued message(s) for ${args.workerId}.`
        : `Skipped queue drain for ${args.workerId}: ${args.reason}.`,
      source: args.source,
      workerStatus: args.workerStatus,
      pendingCount: args.pendingCount,
      decision: args.decision,
      reason: args.reason,
    },
  });
}

export async function drainQueuedWorkerMessagesWithObservation(args: {
  runId: string;
  workerId: string;
  workerStatus: string;
  source: string;
  snapshot?: ReturnType<typeof normalizeAgentRecord> | null;
}) {
  const pendingCount = await pendingWorkerQueueCount(args.runId, args.workerId);
  if (pendingCount === 0) {
    return 0;
  }

  const snapshot = args.snapshot ?? null;
  const hasPendingElicitation = hasPendingElicitationSignal(snapshot);
  const drainable = hasPendingElicitation || isWorkerQueueDrainableStatus(args.workerStatus);
  await recordQueueDrainDecision({
    ...args,
    pendingCount,
    decision: drainable ? "drain" : "skip",
    reason: hasPendingElicitation
      ? "pending_elicitation"
      : drainable
        ? "worker_drainable"
        : "worker_not_drainable",
  });
  if (!drainable) {
    return 0;
  }

  // Deliver on a background task rather than inline. Sync passes are
  // serialized through `liveSyncQueue`, and the drain runs a full worker turn:
  // awaiting it here parked the entire sync chain for the length of the turn.
  // When the agent raised an elicitation mid-turn that became a deadlock — the
  // turn cannot finish until the question is answered, and the question is
  // only surfaced by the snapshot writes in the very sync pass that is stuck
  // waiting for the turn. Claiming is atomic (`status = 'pending'` guard), and
  // an in-flight delivery leaves `pendingCount` at 0, so overlapping passes
  // return above instead of double-delivering.
  const delivery = trackConversationBackgroundTask((async () => {
    const deliveredCount = await drainQueuedWorkerMessages({
      runId: args.runId,
      workerId: args.workerId,
      snapshot,
    });
    emitNamedEvent({
      kind: "queue.drain_finished",
      runId: args.runId,
      workerId: args.workerId,
      source: args.source,
      pendingCount,
      deliveredCount,
    });
    await recordExecutionEvent({
      runId: args.runId,
      workerId: args.workerId,
      eventType: "queue_drain_finished",
      details: {
        summary: `Queue drain finished for ${args.workerId}: delivered ${deliveredCount} of ${pendingCount}.`,
        source: args.source,
        pendingCount,
        deliveredCount,
      },
    });
    return deliveredCount;
  })(), { runId: args.runId });
  delivery.catch((error) => {
    console.error(`Queued message drain failed for ${args.workerId}:`, error);
  });
  return 0;
}

function isRecoverableMissingDirectWorkerStatus(status: string) {
  const normalized = normalizedStatus(status);
  return ["starting", "working", "stuck", "recovering", "lost"].includes(normalized);
}

function isCancelledWorkerStatus(status: string | null | undefined) {
  const normalized = normalizedStatus(status);
  return normalized === "cancelled" || normalized === "canceled";
}

function isIdleDirectWorkerWithStaleCurrentText(worker: typeof workers.$inferSelect) {
  if (normalizedStatus(worker.status) !== "idle") {
    return false;
  }

  const currentText = worker.currentText.trim();
  if (!currentText) {
    return false;
  }

  const lastText = worker.lastText.trim();
  return !lastText || currentText === lastText;
}

async function clearStaleDirectCurrentText(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
  if (!isDirectRunMode(run.mode) || !isTerminalRunStatus(run.status) || !isIdleDirectWorkerWithStaleCurrentText(worker)) {
    return false;
  }

  const cleared = await withWorkerOutputWriteFence(run.id, worker.id, () => (
    withSqliteBusyRetry(() => db.update(workers).set({
      currentText: "",
      lastText: worker.lastText || worker.currentText,
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, worker.id),
      eq(workers.turnGeneration, worker.turnGeneration),
    )).returning({ id: workers.id }).get())
  ));
  if (!cleared) {
    return true;
  }
  notifyEventStreamSubscribers();
  return true;
}

function workerCreatedAtMs(worker: typeof workers.$inferSelect) {
  const time = worker.createdAt.getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareWorkersForFollowUp(a: typeof workers.$inferSelect, b: typeof workers.$inferSelect) {
  const workerNumberDiff = (b.workerNumber ?? 0) - (a.workerNumber ?? 0);
  if (workerNumberDiff !== 0) {
    return workerNumberDiff;
  }

  const createdAtDiff = workerCreatedAtMs(b) - workerCreatedAtMs(a);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return b.id.localeCompare(a.id);
}

function selectConversationWorker(runId: string, allWorkers: Array<typeof workers.$inferSelect>) {
  const sortedWorkers = allWorkers
    .filter((candidate) => candidate.runId === runId)
    .sort(compareWorkersForFollowUp);
  return sortedWorkers.find((worker) => !isCancelledWorkerStatus(worker.status)) ?? sortedWorkers[0] ?? null;
}

async function clearMatchingRunFailureMessage(run: typeof runs.$inferSelect) {
  if (!run.lastError) {
    return;
  }

  await db.delete(messages).where(and(
    eq(messages.runId, run.id),
    eq(messages.role, "system"),
    eq(messages.kind, "error"),
    eq(messages.content, `Run failed: ${run.lastError}`),
  ));
}

let bridgeSyncInFlight: Promise<void> | null = null;

/**
 * Watchdog-driven reconciliation between the bridge runtime and persisted
 * worker/run state. Turn completions are normally persisted by the awaiting
 * send-message call, or by the SSE-driven sync that runs while a client is
 * connected — but both die with their in-flight request (server restart,
 * dropped ACP roundtrip, phone backgrounded the tab). A worker then sits at
 * status='working' forever while the bridge agent finished its turn long
 * ago, and the stuck-worker reaper keeps cancelling and re-delivering the
 * same prompt every timeout window. This sweep closes the gap from the 15s
 * watchdog without requiring any connected client.
 */
export function syncConversationSessionsFromBridge(): Promise<void> {
  if (bridgeSyncInFlight) {
    return bridgeSyncInFlight;
  }

  bridgeSyncInFlight = (async () => {
    let rawAgents: unknown[];
    try {
      rawAgents = await listAgents({ retryIndefinitely: false });
    } catch {
      // Bridge down or unreachable — there is no live state to reconcile
      // against; the next sweep will retry.
      return;
    }
    await syncConversationSessions(rawAgents);
  })().finally(() => {
    bridgeSyncInFlight = null;
  });
  return bridgeSyncInFlight;
}

type SyncConversationSessionsOptions = {
  selectedRunId?: string | null;
  refreshPlanningArtifacts?: boolean;
};

let liveSyncQueue: Promise<void> = Promise.resolve();

export function __resetSyncConversationSessionsQueueForTests() {
  liveSyncQueue = Promise.resolve();
}

export async function syncConversationSessions(rawAgents: unknown[], options: SyncConversationSessionsOptions = {}) {
  const runSync = () => syncConversationSessionsUnlocked(rawAgents, options);
  const nextSync = liveSyncQueue.then(runSync, runSync);
  liveSyncQueue = nextSync.catch(() => undefined);
  return nextSync;
}

async function syncConversationSessionsUnlocked(rawAgents: unknown[], options: SyncConversationSessionsOptions = {}) {
  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
  const selectedRunId = options.selectedRunId?.trim() || null;
  const refreshPlanningArtifacts = options.refreshPlanningArtifacts !== false;
  const allRuns = selectedRunId
    ? await db.select().from(runs).where(eq(runs.id, selectedRunId))
    : await db.select().from(runs);
  const allWorkers = selectedRunId
    ? await db.select().from(workers).where(eq(workers.runId, selectedRunId))
    : await db.select().from(workers);
  const allIncidents = selectedRunId
    ? await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, selectedRunId))
    : await db.select().from(recoveryIncidents);
  const activeQuotaIncidents = allIncidents.filter((incident) => (
    incident.kind === "quota_exhausted"
    && (incident.status === "open" || incident.status === "recovering")
  ));
  const runsWithUnsettledIncidents = new Set(
    allIncidents
      .filter((incident) => isUnsettledRecoveryIncidentStatus(incident.status))
      .map((incident) => incident.runId),
  );

  for (const run of allRuns) {
    // A user cancellation is authoritative. The bridge can report the old
    // turn as working until cancellation reaches the provider, but that late
    // snapshot must not reopen recovery or revive the conversation.
    if (isCancelledWorkerStatus(run.status)) {
      continue;
    }

    const quotaIncident = activeQuotaIncidents.find((incident) => incident.runId === run.id);
    const quotaWorker = allWorkers.find((candidate) => candidate.id === quotaIncident?.workerId);
    const quotaRecoveryOwnsPersistedState = Boolean(
      quotaIncident
      && (
        run.status === "quota_waiting"
        || normalizedStatus(quotaWorker?.status) === "cred-exhausted"
      ),
    );
    if (quotaIncident && quotaRecoveryOwnsPersistedState) {
      if (run.status !== "quota_waiting" || run.lastError || run.failedAt) {
        const updated = await withSqliteBusyRetry(() => db.update(runs).set({
          status: "quota_waiting",
          failedAt: null,
          lastError: null,
          updatedAt: new Date(),
        }).where(and(
          eq(runs.id, run.id),
          eq(runs.status, run.status),
        )).returning({ id: runs.id }));
        if (updated.length > 0) {
          emitNamedEvent({
            kind: "recovery.quota_wait_preserved",
            runId: run.id,
            incidentId: quotaIncident.id,
            previousStatus: run.status,
          });
          await recordExecutionEvent({
            runId: run.id,
            workerId: quotaIncident.workerId,
            planItemId: null,
            eventType: "quota_wait_preserved",
            details: {
              summary: "Reload reconciliation kept quota recovery authoritative over stale run state.",
              incidentId: quotaIncident.id,
              previousStatus: run.status,
            },
          });
          notifyEventStreamSubscribers();
        }
      }
      continue;
    }

    const staleBusyFailure = isAgentBusyRunFailure(run);
    const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
    const staleImplementationConnectionFailure = isRecoverableImplementationConnectionFailure(run);
    if (run.mode === "implementation") {
      const implementationWorkers = allWorkers.filter((candidate) => candidate.runId === run.id);
      let syncedActiveLiveWorker = false;

      for (const implementationWorker of implementationWorkers) {
        const implementationAgent = agents.find((candidate) => candidate.name === implementationWorker.id);
        const cancelledWorkerHasMatchingLiveSession = Boolean(
          implementationAgent
          && implementationWorker.bridgeSessionId
          && implementationWorker.bridgeSessionMode
          && implementationAgent.sessionId === implementationWorker.bridgeSessionId
          && implementationAgent.sessionMode === implementationWorker.bridgeSessionMode,
        );
        if (isCancelledWorkerStatus(implementationWorker.status)
          && !cancelledWorkerHasMatchingLiveSession) {
          continue;
        }
        if (!implementationAgent || !isCleanLiveAgent(implementationAgent) || !isActiveLiveAgent(implementationAgent)) {
          continue;
        }

        await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
        await withSqliteBusyRetry(() => db.update(workers).set({
          status: implementationAgent.state,
          cwd: implementationAgent.cwd || implementationWorker.cwd,
          currentText: implementationAgent.currentText,
          lastText: implementationAgent.lastText,
          bridgeSessionId: implementationAgent.sessionId ?? implementationWorker.bridgeSessionId,
          bridgeSessionMode: implementationAgent.sessionMode ?? implementationWorker.bridgeSessionMode,
          updatedAt: new Date(),
        }).where(eq(workers.id, implementationWorker.id)));
        syncedActiveLiveWorker = true;
      }

      if (syncedActiveLiveWorker) {
        if (run.status !== "running" || run.failedAt || run.lastError) {
          await withSqliteBusyRetry(() => db.update(runs).set({
            status: "running",
            failedAt: null,
            lastError: null,
            updatedAt: new Date(),
          }).where(eq(runs.id, run.id)));
          await clearMatchingRunFailureMessage(run);
          startSupervisorRun(run.id);
        }
        continue;
      }

      if (!staleImplementationTransientFailure) {
        continue;
      }

      const implementationWorker = implementationWorkers[0];
      const implementationAgent = implementationWorker
        ? agents.find((candidate) => candidate.name === implementationWorker.id)
        : null;
      if (!implementationWorker || !implementationAgent || !isCleanLiveAgent(implementationAgent)) {
        if (staleImplementationConnectionFailure) {
          const resumableWorker = implementationWorkers.find((worker) => worker.bridgeSessionId?.trim());
          if (resumableWorker) {
            await withSqliteBusyRetry(() => db.update(runs).set({
              status: "running",
              failedAt: null,
              lastError: null,
              updatedAt: new Date(),
            }).where(eq(runs.id, run.id)));
            await clearMatchingRunFailureMessage(run);
            startSupervisorRun(run.id);
          }
        }
        continue;
      }

      await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
      await withSqliteBusyRetry(() => db.update(workers).set({
        status: implementationAgent.state,
        cwd: implementationAgent.cwd || implementationWorker.cwd,
        currentText: implementationAgent.currentText,
        lastText: implementationAgent.lastText,
        updatedAt: new Date(),
      }).where(eq(workers.id, implementationWorker.id)));
      await withSqliteBusyRetry(() => db.update(runs).set({
        status: "running",
        failedAt: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id)));
      await clearMatchingRunFailureMessage(run);
      startSupervisorRun(run.id);
      continue;
    }

    const worker = selectConversationWorker(run.id, allWorkers);
    if (!worker) {
      continue;
    }

    if (await clearStaleDirectCurrentText(run, worker)) {
      continue;
    }

    const agent = agents.find((candidate) => candidate.name === worker.id);
    const selectedTerminalDirectRunStillStreaming = Boolean(
      options.selectedRunId === run.id
      && isDirectRunMode(run.mode)
      && agent
      && isActiveLiveAgent(agent),
    );
    if (isTerminalRunStatus(run.status) && !staleBusyFailure && !selectedTerminalDirectRunStillStreaming) {
      // A queue row written in the same beat that the run reached a terminal
      // state would otherwise strand forever: this loop skips terminal runs,
      // and the persisted loop below skips them too, so no drain is ever
      // reached and the row sits `pending` for good — a restart does not help
      // either, since boot recovery only reclaims rows stuck at `delivering`.
      // Drain against the still-live agent rather than falling through the
      // whole sync body, which would rewrite run and worker state as a side
      // effect of what should only be a queue flush.
      if (agent) {
        await drainQueuedWorkerMessagesWithObservation({
          runId: run.id,
          workerId: worker.id,
          workerStatus: agent.state,
          source: "terminal_run_pending_queue",
          snapshot: agent,
        });
      }
      continue;
    }

    if (!agent) {
      continue;
    }

    if (
      isDirectRunMode(run.mode)
      && worker.status.trim().toLowerCase().split(":")[0]?.trim() === "idle"
      && isIdleLiveAgentWithoutOutput(agent)
    ) {
      await withWorkerOutputWriteFence(run.id, worker.id, async () => {
        const failedWorker = await withSqliteBusyRetry(() => db.update(workers).set({
          status: "error",
          cwd: agent.cwd || worker.cwd,
          currentText: agent.currentText,
          lastText: agent.lastText,
          outputLog: EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
          updatedAt: new Date(),
        }).where(and(
          eq(workers.id, worker.id),
          eq(workers.turnGeneration, worker.turnGeneration),
        )).returning({ id: workers.id }).get());
        if (failedWorker) {
          await persistRunFailure(run.id, new Error(EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
            surface: { code: "worker.idle.empty_output", workerId: worker.id },
          });
        }
      });
      continue;
    }

    const outputPersisted = await writeWorkerOutputEntries(
      run.id,
      worker.id,
      agent.outputEntries,
      { expectedTurnGeneration: worker.turnGeneration },
    );
    if (!outputPersisted) {
      continue;
    }
    const nextRunState = resolveSyncedRunState(run, agent);
    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
    const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
    const nextWorkerCwd = agent.cwd || worker.cwd;
    const nextWorkerCurrentText = quiescedDirectWorker ? "" : agent.currentText;
    const workerChanged = worker.status !== nextWorkerStatus
      || worker.cwd !== nextWorkerCwd
      || worker.currentText !== nextWorkerCurrentText
      || worker.lastText !== agent.lastText;
    const workerUpdatedAt = new Date();
    if (workerChanged) {
      const workerUpdated = await withSqliteBusyRetry(() => db.update(workers).set({
        status: nextWorkerStatus,
        cwd: nextWorkerCwd,
        currentText: nextWorkerCurrentText,
        lastText: agent.lastText,
        updatedAt: workerUpdatedAt,
      }).where(and(
        eq(workers.id, worker.id),
        eq(workers.turnGeneration, worker.turnGeneration),
      )).returning({ id: workers.id }).get());
      if (!workerUpdated) {
        continue;
      }
    }
    if (worker.status !== nextWorkerStatus) {
      emitNamedEvent({
        kind: "worker.status",
        runId: run.id,
        workerId: worker.id,
        prev: worker.status,
        next: nextWorkerStatus,
      });
    }
    // A worker that is working disproves any recovery state recorded before its
    // current working period began. Recovery bookkeeping is otherwise only
    // written when a turn *ends*, so a path that opens an incident and then
    // awaits a full turn leaves the banner up for the whole turn — or forever,
    // if the turn never returns.
    //
    // This deliberately does not wait to *observe* the transition into working.
    // The recovery paths set the worker row to `working` themselves, so by the
    // time the live sync looks the status already matches and there is no edge
    // left to catch; a stale incident then outlived the resume that disproved it
    // by the length of the turn. Fencing on `activeWorkStartedAt` instead of the
    // transition keeps the sweep from clearing anything opened during this turn,
    // and makes repeat ticks no-ops once the leftovers are settled.
    //
    // A worker that was already working carries its period start in
    // `activeWorkStartedAt`; one transitioning into working starts its period
    // now. If it was already working and the column is empty we cannot tell the
    // two apart, so the sweep sits it out rather than guess a fence that would
    // clear incidents belonging to the turn in progress.
    const workingPeriodStartedAt = normalizedStatus(worker.status) === "working"
      ? worker.activeWorkStartedAt
      : workerUpdatedAt;
    if (
      normalizedStatus(nextWorkerStatus) === "working"
      && workingPeriodStartedAt
      && runsWithUnsettledIncidents.has(run.id)
    ) {
      await resolveRecoveryIncidentsDisprovedByActiveWork({
        runId: run.id,
        workerId: worker.id,
        since: workingPeriodStartedAt,
      });
    }

    if (run.mode === "planning") {
      if (refreshPlanningArtifacts) {
        const result = await refreshPlanningArtifactsForRun({
          run,
          worker,
          snapshot: agent,
          status: nextRunState === "running" ? "working" : undefined,
        });
        if (staleBusyFailure && result.status !== "failed") {
          await clearMatchingRunFailureMessage(run);
        }
      }
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: agent.state,
        source: "live_planning_sync",
      });
      continue;
    }

    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        workerStatus: nextWorkerStatus,
        renderedOutput: agent.renderedOutput,
        currentText: agent.currentText,
        lastText: agent.lastText,
        outputEntries: agent.outputEntries,
        pendingPermissions: agent.pendingPermissions,
        pendingElicitations: agent.pendingElicitations,
      });
      // The turn has settled, so any plan file the goal names has stopped
      // moving. Re-derive it here to pick up checklist items the turn ticked
      // off; the call is a no-op when the goal has no derivable plan.
      await refreshDerivedGoalPlan(run.id, "turn_settled");
    } else {
      await withWorkerOutputWriteFence(run.id, worker.id, async () => {
        const current = await db.select({ turnGeneration: workers.turnGeneration })
          .from(workers)
          .where(eq(workers.id, worker.id))
          .get();
        if (current?.turnGeneration !== worker.turnGeneration) {
          return;
        }
        const syncedLastError = nextRunState === "failed"
          ? await resolveSyncedFailureMessage(run.id, worker.id, worker.type, run.lastError, agent.lastError)
          : null;
        await withSqliteBusyRetry(() => db.update(runs).set({
          status: nextRunState,
          lastError: syncedLastError,
          failedAt: nextRunState === "failed" ? run.failedAt : null,
          updatedAt: new Date(),
        }).where(eq(runs.id, run.id)));
      });
    }
    if (staleBusyFailure && nextRunState !== "failed") {
      await clearMatchingRunFailureMessage(run);
    }
    await drainQueuedWorkerMessagesWithObservation({
      runId: run.id,
      workerId: worker.id,
      workerStatus: nextWorkerStatus,
      source: "live_worker_sync",
      snapshot: agent,
    });
  }

  for (const run of allRuns) {
    const staleBusyFailure = isAgentBusyRunFailure(run);
    if (run.mode === "implementation" || (isTerminalRunStatus(run.status) && !staleBusyFailure)) {
      continue;
    }

    const worker = selectConversationWorker(run.id, allWorkers);
    if (!worker || agents.some((agent) => agent.name === worker.id)) {
      continue;
    }

    if (
      isRecoverableMissingDirectWorkerStatus(worker.status)
      && (
        options.selectedRunId === run.id
        || normalizedStatus(worker.status) === "lost"
      )
    ) {
      const recoveryResult = await reconcileRunRecovery({
        runId: run.id,
        liveAgents: agents,
        source: "conversation-sync",
      });
      if (recoveryResult.action !== "none" && recoveryResult.action !== "wait_for_backoff") {
        continue;
      }
    }

    if (await isEmptyIdlePersistedWorker(worker)) {
      await withWorkerOutputWriteFence(run.id, worker.id, async () => {
        const failedWorker = await withSqliteBusyRetry(() => db.update(workers).set({
          status: "error",
          outputLog: MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
          updatedAt: new Date(),
        }).where(and(
          eq(workers.id, worker.id),
          eq(workers.turnGeneration, worker.turnGeneration),
        )).returning({ id: workers.id }).get());
        if (failedWorker) {
          await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
            surface: { code: "worker.idle.missing_output", workerId: worker.id },
          });
        }
      });
      continue;
    }

    const nextRunState = await resolvePersistedRunState(run, worker);
    if (run.mode === "planning") {
      if (refreshPlanningArtifacts) {
        await refreshPlanningArtifactsForRun({
          run,
          worker,
          status: nextRunState === "running" ? "working" : undefined,
        });
      }
      continue;
    }

    if (nextRunState === run.status) {
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: worker.status,
        source: "persisted_state_unchanged",
      });
      continue;
    }

    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        workerStatus: worker.status,
        outputLog: worker.outputLog,
        currentText: worker.currentText,
        lastText: worker.lastText,
        outputEntriesJson: worker.outputEntriesJson,
      });
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: worker.status,
        source: "persisted_direct_completion",
      });
    } else {
      await withWorkerOutputWriteFence(run.id, worker.id, async () => {
        const current = await db.select({ turnGeneration: workers.turnGeneration })
          .from(workers)
          .where(eq(workers.id, worker.id))
          .get();
        if (current?.turnGeneration !== worker.turnGeneration) {
          return;
        }
        await withSqliteBusyRetry(() => db.update(runs).set({
          status: nextRunState,
          updatedAt: new Date(),
        }).where(eq(runs.id, run.id)));
      });
    }
  }
}
