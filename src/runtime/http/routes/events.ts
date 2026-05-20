import { db } from "@/server/db";
import { messages, plans, runs, accounts, workers, planItems, clarifications, executionEvents, supervisorInterventions, queuedConversationMessages, recoveryIncidents, planningReviewRuns, planningReviewRounds, planningReviewFindings, processSessions, conversationReadMarkers } from "@/server/db/schema";
import { BRIDGE_URL } from "@/server/bridge-client";
import { isTerminalRunStatus } from "@/lib/run-status";
import { buildAppError, type AppErrorPayload } from "@/server/api-errors";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
import { readWorkerLatestSeq } from "@/server/workers/output-store";
import { getEventStreamNotificationVersion, waitForEventStreamNotification } from "@/server/events/live-updates";
import {
  getEventCursor,
  getNamedEventsSince,
  recordSnapshotMarker,
} from "@/server/events/named-events";
import { withEventPayloadChecksum } from "@/server/events/payload-checksum";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { serializeMessageRecord } from "@/server/conversations/message-records";
import { serializeQueuedConversationMessage } from "@/server/conversations/queued-message-records";
import { buildAwaitingUserQuestionInvariantErrors } from "@/server/events/lifecycle-invariants";
import { serializeSessionRecord } from "@/server/session-providers/session-records";
import { reconcileOrphanedProcessSessions } from "@/server/session-providers/process-store";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { startSlowProbe } from "@/server/slow-probe";
import { toNextRequest } from "./next-request";

const STREAM_REFRESH_INTERVAL_MS = 15_000;
const RUNTIME_AGENT_GRACE_MS = 150;
const RUNTIME_AGENT_TIMEOUT_MS = 5000;
const EXECUTION_EVENT_LIMIT = 100;
const EVENT_PAYLOAD_CACHE_LIMIT = 50;

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      fetch(url, { signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Agent runtime list request timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function readPersistedEventRecords(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  await reconcileOrphanedProcessSessions();
  probe?.mark("reconcile");
  const selectedRunId = options.selectedRunId?.trim() || null;
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt), desc(plans.id));
  probe?.mark("q.plans");
  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt), desc(runs.id));
  probe?.mark("q.runs");
  const visibleRunIds = allRuns.map((run) => run.id);
  const selectedRun = selectedRunId ? allRuns.find((run) => run.id === selectedRunId) ?? null : null;
  const selectedPlanId = selectedRun?.planId ?? null;
  const transcriptRunIds = selectedRunId
    ? [
        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
        selectedRunId,
      ]
    : [];

  const [
    msgs,
    allAccounts,
    allWorkers,
    selectedAgentWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allReviewRuns,
    allReviewRounds,
    allReviewFindings,
    allProcessSessions,
    allReadMarkers,
  ] = await Promise.all([
    selectedRunId
      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt), asc(messages.id))
      : [],
    db.select().from(accounts),
    db.select({
      id: workers.id,
      runId: workers.runId,
      type: workers.type,
      status: workers.status,
      workerNumber: workers.workerNumber,
      title: workers.title,
      initialPrompt: workers.initialPrompt,
      createdAt: workers.createdAt,
      updatedAt: workers.updatedAt,
    }).from(workers).where(visibleRunIds.length > 0 ? inArray(workers.runId, visibleRunIds) : eq(workers.id, "__none__")).orderBy(asc(workers.runId), asc(workers.createdAt), asc(workers.id)),
    selectedRunId
      ? db.select({
        id: workers.id,
        runId: workers.runId,
        type: workers.type,
        status: workers.status,
        cwd: workers.cwd,
        outputLog: workers.outputLog,
        currentText: workers.currentText,
        lastText: workers.lastText,
        bridgeSessionId: workers.bridgeSessionId,
        bridgeSessionMode: workers.bridgeSessionMode,
        workerNumber: workers.workerNumber,
        title: workers.title,
        initialPrompt: workers.initialPrompt,
        activeWorkStartedAt: workers.activeWorkStartedAt,
        activeWorkDurationMs: workers.activeWorkDurationMs,
        createdAt: workers.createdAt,
        updatedAt: workers.updatedAt,
      }).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
      : [],
    selectedPlanId
      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
      : [],
    selectedRunId
      ? db.select().from(clarifications).where(eq(clarifications.runId, selectedRunId)).orderBy(desc(clarifications.createdAt), desc(clarifications.id))
      : [],
    selectedRunId
      ? db.select().from(executionEvents).where(eq(executionEvents.runId, selectedRunId)).orderBy(desc(executionEvents.createdAt), desc(executionEvents.id)).limit(EXECUTION_EVENT_LIMIT)
      : [],
    selectedRunId
      ? db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, selectedRunId)).orderBy(desc(supervisorInterventions.createdAt), desc(supervisorInterventions.id))
      : [],
    selectedRunId
      ? db.select().from(queuedConversationMessages)
        .where(and(
          eq(queuedConversationMessages.runId, selectedRunId),
          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
        ))
        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
      : [],
    selectedRunId
      ? db.select().from(recoveryIncidents)
        .where(eq(recoveryIncidents.runId, selectedRunId))
        .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
        .limit(20)
      : [],
    selectedRunId
      ? db.select().from(planningReviewRuns).where(eq(planningReviewRuns.runId, selectedRunId)).orderBy(desc(planningReviewRuns.createdAt), desc(planningReviewRuns.id))
      : [],
    selectedRunId
      ? db.select().from(planningReviewRounds).where(eq(planningReviewRounds.runId, selectedRunId)).orderBy(asc(planningReviewRounds.roundNumber))
      : [],
    selectedRunId
      ? db.select().from(planningReviewFindings).where(eq(planningReviewFindings.runId, selectedRunId)).orderBy(desc(planningReviewFindings.createdAt), desc(planningReviewFindings.id))
      : [],
    db.select().from(processSessions),
    db.select().from(conversationReadMarkers).where(visibleRunIds.length > 0 ? inArray(conversationReadMarkers.runId, visibleRunIds) : eq(conversationReadMarkers.runId, "__none__")),
  ]);
  probe?.mark("q.parallel15");

  return {
    msgs,
    allPlans,
    allRuns,
    allAccounts,
    allWorkers,
    selectedAgentWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allReviewRuns,
    allReviewRounds,
    allReviewFindings,
    allProcessSessions,
    allReadMarkers,
  };
}


type EventPayloadOptions = {
  selectedRunId?: string | null;
};

type PersistedEventRecords = Awaited<ReturnType<typeof readPersistedEventRecords>>;
type EventPayload = ReturnType<typeof buildEventPayload>;

const WORKER_INITIAL_PROMPT_PREVIEW_LIMIT = 1_000;
const AGENT_TEXT_FIELD_LIMIT = 4_000;
const EXECUTION_EVENT_DETAIL_LIMIT = 1_000;
const SUPERVISOR_INTERVENTION_TEXT_LIMIT = 2_000;

function truncateText(value: string | null | undefined, limit: number) {
  if (!value || value.length <= limit) {
    return value ?? "";
  }

  return `${value.slice(0, limit)}

[Truncated ${value.length - limit} characters in live payload]`;
}

function compactWorkerRecord(worker: PersistedEventRecords["allWorkers"][number]) {
  return {
    id: worker.id,
    runId: worker.runId,
    type: worker.type,
    status: worker.status,
    workerNumber: worker.workerNumber,
    title: worker.title,
    initialPrompt: truncateText(worker.initialPrompt, WORKER_INITIAL_PROMPT_PREVIEW_LIMIT),
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
}

function selectedRunWorkers(
  records: PersistedEventRecords,
  options: EventPayloadOptions,
) {
  const selectedRunId = options.selectedRunId?.trim();
  if (!selectedRunId) {
    return [];
  }

  return records.selectedAgentWorkers;
}

function selectedRunIds(options: EventPayloadOptions) {
  const selectedRunId = options.selectedRunId?.trim();
  return selectedRunId ? new Set([selectedRunId]) : null;
}

function selectedMessageRunIds(records: PersistedEventRecords, options: EventPayloadOptions) {
  const selectedRunId = options.selectedRunId?.trim();
  if (!selectedRunId) {
    return [];
  }

  const selectedRun = records.allRuns.find((run) => run.id === selectedRunId);
  return [
    ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
    selectedRunId,
  ];
}

function compactExecutionEvent(event: PersistedEventRecords["allExecutionEvents"][number]) {
  return {
    ...event,
    details: compactExecutionEventDetails(event.details),
  };
}

function compactExecutionEventDetails(details: string | null) {
  if (!details?.trim()) {
    return details ?? null;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    const compacted: Record<string, unknown> = {};

    for (const key of [
      "summary",
      "reason",
      "error",
      "mode",
      "seconds",
      "recoveryState",
      "recommendedAction",
      "resetAt",
      "resumeAt",
      "scheduledWakeAt",
      "quotaResetSource",
      "quotaResetConfidence",
      "retryAfterMs",
      "provider",
      "sourceType",
      "rawText",
    ]) {
      const value = parsed[key];
      if (typeof value === "string") {
        compacted[key] = truncateText(value, EXECUTION_EVENT_DETAIL_LIMIT);
      } else if (typeof value === "number") {
        compacted[key] = value;
      }
    }

    return Object.keys(compacted).length > 0 ? JSON.stringify(compacted) : "{}";
  } catch {
    return JSON.stringify({
      summary: truncateText(details, EXECUTION_EVENT_DETAIL_LIMIT),
    });
  }
}

function compactSupervisorIntervention(intervention: PersistedEventRecords["allSupervisorInterventions"][number]) {
  return {
    ...intervention,
    prompt: truncateText(intervention.prompt, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
    summary: truncateText(intervention.summary, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
  };
}

function compactReviewFinding(finding: PersistedEventRecords["allReviewFindings"][number]) {
  return {
    ...finding,
    details: truncateText(finding.details, 2_000),
    recommendation: truncateText(finding.recommendation, 2_000),
  };
}

function compactRecoveryIncident(incident: PersistedEventRecords["allRecoveryIncidents"][number]) {
  return {
    id: incident.id,
    runId: incident.runId,
    workerId: incident.workerId,
    queuedMessageId: incident.queuedMessageId,
    kind: incident.kind,
    status: incident.status,
    autoAttemptCount: incident.autoAttemptCount,
    lastError: truncateText(incident.lastError, 2_000),
    details: compactExecutionEventDetails(incident.details),
    detectedAt: incident.detectedAt,
    updatedAt: incident.updatedAt,
    resolvedAt: incident.resolvedAt,
  };
}

function deriveRecoveryState(incidents: PersistedEventRecords["allRecoveryIncidents"]) {
  const active = incidents.find((incident) => (
    incident.status === "open"
    || incident.status === "recovering"
    || incident.status === "needs_user"
    || incident.status === "failed"
  ));
  if (!active) {
    return null;
  }

  let parsedDetails: Record<string, unknown> = {};
  try {
    parsedDetails = active.details ? JSON.parse(active.details) as Record<string, unknown> : {};
  } catch {
    parsedDetails = {};
  }

  return {
    kind: String(parsedDetails.recoveryState ?? active.kind),
    status: active.status,
    workerId: active.workerId,
    queuedMessageId: active.queuedMessageId,
    message: typeof parsedDetails.reason === "string" ? parsedDetails.reason : active.lastError,
    recommendedAction: String(parsedDetails.recommendedAction ?? (
      active.status === "recovering" ? "none" : "manual_resume"
    )),
    lastError: active.lastError,
    attemptCount: active.autoAttemptCount,
    nextAttemptAt: typeof parsedDetails.nextAttemptAt === "string" ? parsedDetails.nextAttemptAt : null,
    resumeAt: typeof parsedDetails.resumeAt === "string" ? parsedDetails.resumeAt : null,
    quotaResetSource: typeof parsedDetails.quotaResetSource === "string" ? parsedDetails.quotaResetSource : null,
    quotaResetConfidence: typeof parsedDetails.quotaResetConfidence === "string" ? parsedDetails.quotaResetConfidence : null,
    policyDecision: typeof parsedDetails.decision === "string" ? parsedDetails.decision : null,
  };
}

function compactAgentSnapshot(agent: ReturnType<typeof buildLiveWorkerSnapshots>[number]) {
  // Worker conversation content (outputEntries) is no longer carried
  // on the /api/events snapshot. Clients fetch it via
  // /api/workers/:workerId/entries through `WorkerEntriesManager`. The
  // agents[] array stays for non-content metadata: state, the
  // "thinking…" indicator, bridge-missing flag, last error.
  return {
    ...agent,
    outputEntries: [],
    renderedOutput: null,
    currentText: truncateText(agent.currentText, AGENT_TEXT_FIELD_LIMIT),
    lastText: truncateText(agent.lastText, AGENT_TEXT_FIELD_LIMIT),
    outputLog: truncateText(agent.outputLog, AGENT_TEXT_FIELD_LIMIT),
    displayText: truncateText(agent.displayText, AGENT_TEXT_FIELD_LIMIT),
    stderrBuffer: (agent.stderrBuffer ?? []).slice(-10).map((line) => truncateText(line, 2_000)),
  };
}

async function buildWorkerEntrySeqs(workers: Array<{ id: string; runId: string }>) {
  const seqs = await Promise.all(
    workers.map(async (worker) => {
      const seq = await readWorkerLatestSeq(worker.runId, worker.id);
      return seq > 0 ? [worker.id, seq] as const : null;
    }),
  );
  return Object.fromEntries(seqs.filter((seq): seq is readonly [string, number] => Boolean(seq)));
}

function filterRuntimeAgentsForWorkers(rawAgents: unknown[], scopedWorkers: PersistedEventRecords["allWorkers"]) {
  const workerIds = new Set(scopedWorkers.map((worker) => worker.id));
  if (workerIds.size === 0) {
    return [];
  }

  return rawAgents.filter((agent) => {
    if (typeof agent !== "object" || agent === null) {
      return false;
    }

    const name = (agent as { name?: unknown }).name;
    return typeof name === "string" && workerIds.has(name);
  });
}

function buildEventPayload(
  records: PersistedEventRecords,
  agentsData: ReturnType<typeof buildLiveWorkerSnapshots>,
  frontendErrors: AppErrorPayload[] = [],
  options: EventPayloadOptions = {},
  workerEntrySeqs: Record<string, number> = {},
) {
  const runIds = selectedRunIds(options);
  const messageRunIds = selectedMessageRunIds(records, options);
  const lifecycleErrors = buildAwaitingUserQuestionInvariantErrors({
    runs: records.allRuns,
    messages: records.msgs,
    selectedRunId: options.selectedRunId,
  });
  const processSessionsByRunId = new Map<string, PersistedEventRecords["allProcessSessions"][number]>(
    records.allProcessSessions.map((session) => [session.runId, session]),
  );
  const workersByRunId = new Map<string, PersistedEventRecords["allWorkers"][number]>();
  for (const worker of records.allWorkers) {
    if (!workersByRunId.has(worker.runId)) {
      workersByRunId.set(worker.runId, worker);
    }
  }
  const sessions = records.allRuns.map((run) => serializeSessionRecord({
    run,
    primaryWorker: workersByRunId.get(run.id) ?? null,
    processSession: processSessionsByRunId.get(run.id) ?? null,
  }));
  const readMarkers = Object.fromEntries(
    records.allReadMarkers.map((marker) => [marker.runId, marker.lastReadAt.toISOString()]),
  );
  // Worker conversation content now lives in the unified worker stream
  // (per-worker JSONL, fetched via /api/workers/:workerId/entries). The
  // previous `synthesizeStreamingWorkerMessages` path that fabricated
  // pseudo-messages from `agent.outputEntries` is gone; clients render
  // worker content via `WorkerEntriesManager` instead.
  return withEventPayloadChecksum({
    messages: records.msgs.map(serializeMessageRecord),
    readMarkers,
    plans: records.allPlans,
    runs: records.allRuns,
    sessions,
    accounts: records.allAccounts,
    agents: agentsData.map(compactAgentSnapshot),
    workers: records.allWorkers.map(compactWorkerRecord),
    planItems: records.allPlanItems,
    clarifications: records.allClarifications,
    executionEvents: records.allExecutionEvents
      .slice(0, EXECUTION_EVENT_LIMIT)
      .map(compactExecutionEvent),
    supervisorInterventions: records.allSupervisorInterventions
      .map(compactSupervisorIntervention),
    queuedMessages: records.allQueuedMessages
      .filter((message) => message.status === "pending" || message.status === "delivering")
      .map(serializeQueuedConversationMessage),
    recoveryIncidents: records.allRecoveryIncidents
      .map(compactRecoveryIncident),
    recoveryState: runIds && !isTerminalRunStatus(
      records.allRuns.find((run) => runIds.has(run.id))?.status,
    )
      ? deriveRecoveryState(records.allRecoveryIncidents)
      : null,
    reviewRuns: records.allReviewRuns,
    reviewRounds: records.allReviewRounds,
    reviewFindings: records.allReviewFindings
      .map(compactReviewFinding),
    frontendErrors: [...frontendErrors, ...lifecycleErrors],
    snapshotRunId: options.selectedRunId?.trim() || null,
    messageScope: {
      runIds: messageRunIds,
      complete: true,
    },
    workerEntrySeqs,
  });
}

async function buildPersistedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  const records = await readPersistedEventRecords(options, probe);
  probe?.mark("readRecords.total");
  const scopedWorkers = selectedRunWorkers(records, options);
  const workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
  probe?.mark(`workerSeqs[${scopedWorkers.length}]`);
  const payload = buildEventPayload(
    records,
    buildLiveWorkerSnapshots({
      workers: scopedWorkers,
      runs: records.allRuns,
    }),
    undefined,
    options,
    workerEntrySeqs,
  );
  probe?.mark("buildPayload");
  return payload;
}

type EventPayloadCacheEntry = {
  version: number;
  promise: Promise<EventPayload>;
};

const cachedPersistedPayloads = new Map<string, EventPayloadCacheEntry>();
const cachedRuntimePayloads = new Map<string, EventPayloadCacheEntry>();

export function __clearEventPayloadCachesForTests() {
  cachedPersistedPayloads.clear();
  cachedRuntimePayloads.clear();
}

function eventPayloadCacheKey(options: EventPayloadOptions = {}) {
  return options.selectedRunId?.trim() || "__all__";
}

function shareInFlightEventPayload(
  cache: Map<string, EventPayloadCacheEntry>,
  options: EventPayloadOptions,
  build: () => Promise<EventPayload>,
) {
  const key = eventPayloadCacheKey(options);
  const version = getEventStreamNotificationVersion();
  const existing = cache.get(key);
  if (existing?.version === version) {
    return existing.promise;
  }

  const pending = build().catch((error) => {
    const cached = cache.get(key);
    if (cached?.promise === pending) {
      cache.delete(key);
    }
    throw error;
  });
  cache.set(key, { version, promise: pending });
  pruneEventPayloadCache(cache);
  return pending;
}

function pruneEventPayloadCache(cache: Map<string, EventPayloadCacheEntry>) {
  while (cache.size > EVENT_PAYLOAD_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    cache.delete(oldestKey);
  }
}

function buildSharedPersistedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  return shareInFlightEventPayload(
    cachedPersistedPayloads,
    options,
    () => buildPersistedEventPayload(options, probe),
  );
}

async function buildRuntimeEnrichedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  let records = await readPersistedEventRecords(options, probe);
  probe?.mark("readRecords#1.total");
  let scopedWorkers = selectedRunWorkers(records, options);
  let workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
  probe?.mark(`workerSeqs#1[${scopedWorkers.length}]`);
  let agentsData = buildLiveWorkerSnapshots({
    workers: scopedWorkers,
    runs: records.allRuns,
  });
  const frontendErrors: AppErrorPayload[] = [];

  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/agents`, RUNTIME_AGENT_TIMEOUT_MS);
    probe?.mark("bridge.fetch");
    if (res.ok) {
      const rawAgentsPayload = await res.json();
      const rawAgents = Array.isArray(rawAgentsPayload) ? rawAgentsPayload : [];
      const { syncConversationSessions } = await import("@/server/conversations/sync");
      await syncConversationSessions(rawAgents, {
        selectedRunId: options.selectedRunId,
      });
      probe?.mark("bridge.sync");
      records = await readPersistedEventRecords(options);
      probe?.mark("readRecords#2.total");
      scopedWorkers = selectedRunWorkers(records, options);
      workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
      probe?.mark(`workerSeqs#2[${scopedWorkers.length}]`);
      agentsData = buildLiveWorkerSnapshots({
        agents: filterRuntimeAgentsForWorkers(rawAgents, scopedWorkers),
        workers: scopedWorkers,
        runs: records.allRuns,
      });
    } else {
      const bridgeError = new Error(`Agent runtime list request failed with status ${res.status}.`);
      agentsData = buildLiveWorkerSnapshots({
        workers: scopedWorkers,
        runs: records.allRuns,
        bridgeError,
      });
      if (!isTransientSupervisorError(bridgeError)) {
        frontendErrors.push(buildAppError(
          bridgeError,
          {
            source: "Agent runtime",
            action: "Stream live agent state",
          },
        ));
      }
    }
  } catch (error) {
    agentsData = buildLiveWorkerSnapshots({
      workers: scopedWorkers,
      runs: records.allRuns,
      bridgeError: error,
    });
    if (!isTransientSupervisorError(error)) {
      frontendErrors.push(buildAppError(error, {
        source: "Agent runtime",
        action: "Stream live agent state",
      }));
    }
  }

  return buildEventPayload(records, agentsData, frontendErrors, options, workerEntrySeqs);
}

function buildSharedRuntimeEnrichedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  return shareInFlightEventPayload(
    cachedRuntimePayloads,
    options,
    () => buildRuntimeEnrichedEventPayload(options, probe),
  );
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseLastEventId(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export const handleEventsRequest: OmniHttpHandler = async (request) => {
  const url = new URL(request.url);
  const isSnapshot = url.searchParams.get("snapshot") === "1";
  const persistedOnly = url.searchParams.get("persisted") === "1";
  const probe = isSnapshot
    ? startSlowProbe(`GET /api/events?snapshot=1${persistedOnly ? "&persisted=1" : ""}${url.searchParams.get("runId") ? `&runId=${url.searchParams.get("runId")}` : ""}`)
    : null;
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Events",
    action: "Stream live updates",
  });
  probe?.mark("auth");
  if (auth.response) {
    probe?.end();
    return auth.response;
  }

  const eventPayloadOptions = {
    selectedRunId: url.searchParams.get("runId"),
  } satisfies EventPayloadOptions;

  if (isSnapshot) {
    const payload = persistedOnly
      ? await buildSharedPersistedEventPayload(eventPayloadOptions, probe ?? undefined)
      : await (async () => {
        const { ensureSupervisorRuntimeStarted } = await import("@/server/supervisor/runtime-watchdog");
        await ensureSupervisorRuntimeStarted();
        probe?.mark("ensureSupervisor");
        return buildSharedRuntimeEnrichedEventPayload(eventPayloadOptions, probe ?? undefined);
      })();
    probe?.mark("payload.total");
    const requestedChecksum = url.searchParams.get("checksum")?.trim() || "";

    // Anchor the snapshot to the current cursor so a subsequent SSE
    // connection can pass `Last-Event-ID: <lastEventId>` (or
    // `?lastEventId=`) and receive only events newer than this body.
    // Exposed as a response header to avoid changing the JSON shape
    // that the UI consumes.
    const response = Response.json(
      requestedChecksum && requestedChecksum === payload.snapshotChecksum
        ? {
          notModified: true,
          snapshotChecksum: payload.snapshotChecksum,
          workerEntrySeqs: payload.workerEntrySeqs,
        }
        : payload,
    );
    response.headers.set("x-omni-last-event-id", String(getEventCursor()));
    if (payload.snapshotChecksum) {
      response.headers.set("x-omni-snapshot-checksum", payload.snapshotChecksum);
    }
    probe?.end();
    return response;
  }

  const { ensureSupervisorRuntimeStarted } = await import("@/server/supervisor/runtime-watchdog");
  await ensureSupervisorRuntimeStarted();

  const lastEventIdHeader = request.headers.get("last-event-id");
  const resumeFromHeader = parseLastEventId(lastEventIdHeader);
  const resumeFromQuery = parseLastEventId(url.searchParams.get("lastEventId"));
  const resumeFromId = resumeFromHeader ?? resumeFromQuery;
  const runIdScope = eventPayloadOptions.selectedRunId ?? null;

  let streamClosed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastUpdatePayload = "";
      // Cursor tracking the highest id we've already streamed to this
      // client; used to drain only newly-buffered named events on each
      // poll iteration without re-emitting events we already replayed.
      let lastDeliveredId = resumeFromId ?? getEventCursor();

      const writeFrame = (id: number | null, event: string, serializedData: string) => {
        try {
          const idLine = id === null ? "" : `id: ${id}\n`;
          controller.enqueue(encoder.encode(`${idLine}event: ${event}\ndata: ${serializedData}\n\n`));
        } catch {
          // Stream might be closed
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendEvent = (event: string, data: any, id: number | null = null) => {
        writeFrame(id, event, JSON.stringify(data));
      };
      const sendHeartbeat = () => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Stream might be closed
        }
      };
      const drainBufferedEvents = (options: { throughId?: number | null } = {}) => {
        const replay = getNamedEventsSince(lastDeliveredId, {
          runId: runIdScope,
          throughId: options.throughId,
        });
        if (replay.resyncRequired) {
          // Anchor the resync frame to the current cursor so the
          // client's resume position advances; without an id, the
          // next reconnect would replay this same control message.
          sendEvent("stream.resync_required", { reason: "id_out_of_buffer" }, replay.lastEventId);
          lastDeliveredId = replay.lastEventId;
          return;
        }
        for (const entry of replay.events) {
          if (entry.event.kind === "snapshot.marker") {
            continue;
          }
          writeFrame(entry.id, entry.event.kind, JSON.stringify(entry.event));
          lastDeliveredId = entry.id;
        }
      };
      const sendUpdateIfChanged = (payload: Awaited<ReturnType<typeof buildPersistedEventPayload>>) => {
        const serializedPayload = JSON.stringify(payload);
        if (serializedPayload === lastUpdatePayload) {
          sendHeartbeat();
          return;
        }

        // Flush any named events that landed in the ring *during* the
        // snapshot build before allocating the marker id. Without this,
        // the marker's id would leapfrog those events and the next
        // drain (which uses lastDeliveredId = marker.id) would treat
        // them as already-delivered, silently dropping them.
        drainBufferedEvents();

        lastUpdatePayload = serializedPayload;
        const version = getEventStreamNotificationVersion();
        const marker = recordSnapshotMarker(version, runIdScope);
        // A named event can still land in the tiny window between the
        // pre-marker drain above and marker allocation. Drain only up
        // through the id immediately before the marker, then let the
        // snapshot frame advance the client to the marker id. Events
        // emitted after the marker are delivered by the post-snapshot
        // drain below, preserving monotonic SSE ids.
        drainBufferedEvents({ throughId: marker.id - 1 });
        lastDeliveredId = marker.id;
        writeFrame(marker.id, "update", serializedPayload);
      };

      request.signal.addEventListener("abort", () => {
        streamClosed = true;
      });

      // Replay any events the client missed during disconnect. If their
      // last id has fallen out of the ring, the resync event tells the
      // client to re-bootstrap from /api/events?snapshot=1.
      if (resumeFromId !== null) {
        drainBufferedEvents();
      }

      let notificationVersionAtStart = getEventStreamNotificationVersion();
      while (!streamClosed) {
        try {
          notificationVersionAtStart = getEventStreamNotificationVersion();
          drainBufferedEvents();
          const runtimePayloadPromise = buildSharedRuntimeEnrichedEventPayload(eventPayloadOptions);
          const runtimePayload = await Promise.race([
            runtimePayloadPromise,
            delay(RUNTIME_AGENT_GRACE_MS).then(() => null),
          ]);

          if (runtimePayload) {
            sendUpdateIfChanged(runtimePayload);
          } else {
            sendUpdateIfChanged(await buildSharedPersistedEventPayload(eventPayloadOptions));
            const enrichedPayload = await runtimePayloadPromise;
            if (!streamClosed) {
              sendUpdateIfChanged(enrichedPayload);
            }
          }
          // Named events emitted during snapshot construction must be
          // flushed before we park; otherwise a worker.* event fired
          // mid-build would wait an entire idle cycle to reach the
          // client.
          drainBufferedEvents();
        } catch (e) {
          console.error("SSE Poll Error", e);
          sendEvent("update_error", buildAppError(e, {
            source: "Events",
            action: "Stream live updates",
          }));
        }

        if (!streamClosed) {
          while (!streamClosed) {
            const waitResult = await waitForEventStreamNotification(STREAM_REFRESH_INTERVAL_MS, notificationVersionAtStart);
            if (waitResult.notified) {
              break;
            }
            sendHeartbeat();
          }
        }
      }
    },
    cancel() {
      streamClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
};
