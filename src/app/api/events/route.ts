import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { messages, plans, runs, accounts, workers, planItems, clarifications, executionEvents, supervisorInterventions, queuedConversationMessages, recoveryIncidents } from "@/server/db/schema";
import { BRIDGE_URL } from "@/server/bridge-client";
import { buildAppError } from "@/server/api-errors";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { syncConversationSessions } from "@/server/conversations/sync";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
import { getEventStreamNotificationVersion, waitForEventStreamNotification } from "@/server/events/live-updates";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { serializeMessageRecord } from "@/server/conversations/message-records";
import { serializeQueuedConversationMessage } from "@/server/conversations/queued-messages";
import { isWorkerTerminalToolCallStart } from "@/lib/worker-terminal-processes";

export const dynamic = "force-dynamic";

const STREAM_REFRESH_INTERVAL_MS = 15_000;
const RUNTIME_AGENT_GRACE_MS = 150;
const RUNTIME_AGENT_TIMEOUT_MS = 5000;
const EXECUTION_EVENT_LIMIT = 100;

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

async function readPersistedEventRecords(options: EventPayloadOptions = {}) {
  const selectedRunId = options.selectedRunId?.trim() || null;
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt));
  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt));
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
  ] = await Promise.all([
    selectedRunId
      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt))
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
    }).from(workers),
    selectedRunId
      ? db.select({
        id: workers.id,
        runId: workers.runId,
        type: workers.type,
        status: workers.status,
        cwd: workers.cwd,
        outputLog: workers.outputLog,
        outputEntriesJson: workers.outputEntriesJson,
        currentText: workers.currentText,
        lastText: workers.lastText,
        bridgeSessionId: workers.bridgeSessionId,
        bridgeSessionMode: workers.bridgeSessionMode,
        workerNumber: workers.workerNumber,
        title: workers.title,
        initialPrompt: workers.initialPrompt,
        createdAt: workers.createdAt,
        updatedAt: workers.updatedAt,
      }).from(workers).where(eq(workers.runId, selectedRunId))
      : [],
    selectedPlanId
      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
      : [],
    selectedRunId
      ? db.select().from(clarifications).where(eq(clarifications.runId, selectedRunId)).orderBy(desc(clarifications.createdAt))
      : [],
    selectedRunId
      ? db.select().from(executionEvents).where(eq(executionEvents.runId, selectedRunId)).orderBy(desc(executionEvents.createdAt)).limit(EXECUTION_EVENT_LIMIT)
      : [],
    selectedRunId
      ? db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, selectedRunId)).orderBy(desc(supervisorInterventions.createdAt))
      : [],
    selectedRunId
      ? db.select().from(queuedConversationMessages)
        .where(and(
          eq(queuedConversationMessages.runId, selectedRunId),
          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
        ))
        .orderBy(desc(queuedConversationMessages.createdAt))
      : [],
    selectedRunId
      ? db.select().from(recoveryIncidents)
        .where(eq(recoveryIncidents.runId, selectedRunId))
        .orderBy(desc(recoveryIncidents.updatedAt))
        .limit(20)
      : [],
  ]);

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
  };
}


type EventPayloadOptions = {
  selectedRunId?: string | null;
};

type PersistedEventRecords = Awaited<ReturnType<typeof readPersistedEventRecords>>;
type LiveWorkerOutputEntry = NonNullable<ReturnType<typeof buildLiveWorkerSnapshots>[number]["outputEntries"]>[number];

const WORKER_INITIAL_PROMPT_PREVIEW_LIMIT = 1_000;
const AGENT_TEXT_FIELD_LIMIT = 4_000;
const AGENT_ENTRY_TEXT_LIMIT = 2_000;
const AGENT_ENTRY_RAW_STRING_LIMIT = 20_000;
const AGENT_ENTRY_RAW_JSON_LIMIT = 60_000;
const AGENT_OUTPUT_ENTRY_HEAD_LIMIT = 6;
const AGENT_OUTPUT_ENTRY_TAIL_LIMIT = 24;
const EXECUTION_EVENT_DETAIL_LIMIT = 1_000;
const SUPERVISOR_INTERVENTION_TEXT_LIMIT = 2_000;
const TERMINAL_TOOL_FINAL_STATUSES = new Set(["completed", "failed", "cancelled", "canceled", "done", "error"]);

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

function filterSelectedRunScopedRecords<T extends { runId: string }>(
  records: T[],
  runIds: Set<string> | null,
) {
  return runIds ? records.filter((record) => runIds.has(record.runId)) : [];
}

function selectedPlanIds(records: PersistedEventRecords, runIds: Set<string> | null) {
  if (!runIds) {
    return null;
  }

  return new Set(
    records.allRuns
      .filter((run) => runIds.has(run.id))
      .map((run) => run.planId),
  );
}

function filterSelectedPlanScopedRecords<T extends { planId: string }>(
  records: T[],
  planIds: Set<string> | null,
) {
  return planIds ? records.filter((record) => planIds.has(record.planId)) : [];
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

function isToolOutputEntry(entry: LiveWorkerOutputEntry) {
  return entry.type === "tool_call" || entry.type === "tool_call_update" || entry.type === "permission";
}

function compactRawValue(value: unknown, stringLimit = AGENT_ENTRY_RAW_STRING_LIMIT, depth = 0): unknown {
  if (typeof value === "string") {
    return truncateText(value, stringLimit);
  }

  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (depth >= 8) {
    return "[Truncated nested raw tool payload]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => compactRawValue(item, stringLimit, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        compactRawValue(nestedValue, stringLimit, depth + 1),
      ]),
    );
  }

  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function compactRawToolOutput(rawOutput: unknown) {
  if (rawOutput == null) {
    return undefined;
  }

  const rawOutputRecord = asRecord(rawOutput);
  return {
    truncated: true,
    preview: truncateText(JSON.stringify(rawOutput, null, 2), AGENT_ENTRY_RAW_JSON_LIMIT),
    ...(rawOutputRecord?.changes == null ? {} : {
      changes: compactRawValue(rawOutputRecord.changes, AGENT_ENTRY_RAW_STRING_LIMIT),
    }),
  };
}

function compactLargeRawToolPayload(raw: Record<string, unknown>) {
  return {
    sessionUpdate: raw.sessionUpdate,
    title: raw.title,
    kind: raw.kind,
    path: raw.path,
    filePath: raw.filePath,
    locations: compactRawValue(raw.locations, 2_000),
    rawInput: compactRawValue(raw.rawInput, 10_000),
    rawOutput: compactRawToolOutput(raw.rawOutput),
    content: compactRawValue(raw.content, 10_000),
    _meta: compactRawValue(raw._meta, 10_000),
  };
}

function compactAgentOutputEntryRaw(entry: LiveWorkerOutputEntry) {
  if (!isToolOutputEntry(entry) || typeof entry.raw !== "object" || entry.raw === null) {
    return undefined;
  }

  const raw = entry.raw as Record<string, unknown>;
  const compacted = compactRawValue(raw);
  const serialized = JSON.stringify(compacted);
  if (serialized.length <= AGENT_ENTRY_RAW_JSON_LIMIT) {
    return compacted;
  }

  return compactLargeRawToolPayload(raw);
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function terminalToolIds(entries: LiveWorkerOutputEntry[]) {
  return new Set(
    entries
      .filter(isWorkerTerminalToolCallStart)
      .map((entry) => entry.toolCallId)
      .filter((toolCallId): toolCallId is string => Boolean(toolCallId)),
  );
}

function isTerminalFinalUpdate(entry: LiveWorkerOutputEntry, terminalIds: Set<string>) {
  return isFinalToolUpdate(entry, terminalIds);
}

function isFinalToolUpdate(entry: LiveWorkerOutputEntry, toolCallIds: Set<string>) {
  if (entry.type !== "tool_call_update" || !entry.toolCallId || !toolCallIds.has(entry.toolCallId)) {
    return false;
  }

  const raw = asRecord(entry.raw);
  const rawOutput = asRecord(raw?.rawOutput);
  const status = asNonEmptyString(entry.status)
    || asNonEmptyString(raw?.status)
    || asNonEmptyString(rawOutput?.status);
  if (status && TERMINAL_TOOL_FINAL_STATUSES.has(status.toLowerCase())) {
    return true;
  }

  return /\b(completed|failed|cancelled|canceled|done|error)\b/i.test(entry.text);
}

function toolCallIds(entries: LiveWorkerOutputEntry[]) {
  return new Set(
    entries
      .filter((entry) => entry.type === "tool_call")
      .map((entry) => entry.toolCallId)
      .filter((toolCallId): toolCallId is string => Boolean(toolCallId)),
  );
}

function selectCompactAgentOutputEntries(entries: LiveWorkerOutputEntry[]) {
  const retainedEntryLimit = AGENT_OUTPUT_ENTRY_HEAD_LIMIT + AGENT_OUTPUT_ENTRY_TAIL_LIMIT;
  if (entries.length <= retainedEntryLimit) {
    return entries;
  }

  const head = entries.slice(0, AGENT_OUTPUT_ENTRY_HEAD_LIMIT);
  const tail = entries.slice(-AGENT_OUTPUT_ENTRY_TAIL_LIMIT);
  const terminalIds = terminalToolIds(entries);
  const lifecycleToolIds = toolCallIds(entries);
  const retainedIds = new Set([
    ...head.map((entry) => entry.id),
    ...tail.map((entry) => entry.id),
    ...entries
      .filter((entry) => entry.type === "tool_call" || isFinalToolUpdate(entry, lifecycleToolIds) || isTerminalFinalUpdate(entry, terminalIds))
      .map((entry) => entry.id),
  ]);
  const retainedEntries = entries.filter((entry) => retainedIds.has(entry.id));
  const omittedCount = entries.length - retainedEntries.length;
  if (omittedCount <= 0) {
    return retainedEntries;
  }

  const markerTimestamp = tail[0]?.timestamp ?? head[head.length - 1]?.timestamp ?? new Date(0).toISOString();
  const marker: LiveWorkerOutputEntry = {
    id: `output-entries-omitted:${head[head.length - 1]?.id ?? "start"}:${tail[0]?.id ?? "end"}`,
    type: "message",
    text: `${omittedCount} earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail.`,
    timestamp: markerTimestamp,
  };
  const firstTailId = tail[0]?.id;
  const markerIndex = firstTailId ? retainedEntries.findIndex((entry) => entry.id === firstTailId) : -1;
  if (markerIndex < 0) {
    return [...retainedEntries, marker];
  }

  return [
    ...retainedEntries.slice(0, markerIndex),
    marker,
    ...retainedEntries.slice(markerIndex),
  ];
}

function compactAgentSnapshot(agent: ReturnType<typeof buildLiveWorkerSnapshots>[number]) {
  return {
    ...agent,
    outputEntries: selectCompactAgentOutputEntries(agent.outputEntries ?? []).map((entry) => ({
      id: entry.id,
      type: entry.type,
      text: truncateText(entry.text, AGENT_ENTRY_TEXT_LIMIT),
      timestamp: entry.timestamp,
      toolCallId: entry.toolCallId,
      toolKind: entry.toolKind,
      status: entry.status,
      raw: compactAgentOutputEntryRaw(entry),
    })),
    renderedOutput: null,
    currentText: truncateText(agent.currentText, AGENT_TEXT_FIELD_LIMIT),
    lastText: truncateText(agent.lastText, AGENT_TEXT_FIELD_LIMIT),
    outputLog: truncateText(agent.outputLog, AGENT_TEXT_FIELD_LIMIT),
    displayText: truncateText(agent.displayText, AGENT_TEXT_FIELD_LIMIT),
    stderrBuffer: (agent.stderrBuffer ?? []).slice(-10).map((line) => truncateText(line, 2_000)),
  };
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
  agentsData = buildLiveWorkerSnapshots({
    workers: selectedRunWorkers(records, {}),
    runs: records.allRuns,
  }),
  frontendErrors: unknown[] = [],
  options: EventPayloadOptions = {},
) {
  const runIds = selectedRunIds(options);
  const planIds = selectedPlanIds(records, runIds);

  return {
    messages: records.msgs.map(serializeMessageRecord),
    plans: records.allPlans,
    runs: records.allRuns,
    accounts: records.allAccounts,
    agents: agentsData.map(compactAgentSnapshot),
    workers: records.allWorkers.map(compactWorkerRecord),
    planItems: filterSelectedPlanScopedRecords(records.allPlanItems, planIds),
    clarifications: filterSelectedRunScopedRecords(records.allClarifications, runIds),
    executionEvents: filterSelectedRunScopedRecords(records.allExecutionEvents, runIds)
      .slice(0, EXECUTION_EVENT_LIMIT)
      .map(compactExecutionEvent),
    supervisorInterventions: filterSelectedRunScopedRecords(records.allSupervisorInterventions, runIds)
      .map(compactSupervisorIntervention),
    queuedMessages: filterSelectedRunScopedRecords(records.allQueuedMessages, runIds)
      .filter((message) => message.status === "pending" || message.status === "delivering")
      .map(serializeQueuedConversationMessage),
    recoveryIncidents: filterSelectedRunScopedRecords(records.allRecoveryIncidents, runIds)
      .map(compactRecoveryIncident),
    recoveryState: runIds ? deriveRecoveryState(records.allRecoveryIncidents) : null,
    frontendErrors,
  };
}

async function buildPersistedEventPayload(options: EventPayloadOptions = {}) {
  const records = await readPersistedEventRecords(options);
  return buildEventPayload(
    records,
    buildLiveWorkerSnapshots({
      workers: selectedRunWorkers(records, options),
      runs: records.allRuns,
    }),
    undefined,
    options,
  );
}

async function buildRuntimeEnrichedEventPayload(options: EventPayloadOptions = {}) {
  let records = await readPersistedEventRecords(options);
  let agentsData = buildLiveWorkerSnapshots({
    workers: selectedRunWorkers(records, options),
    runs: records.allRuns,
  });
  const frontendErrors = [];

  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/agents`, RUNTIME_AGENT_TIMEOUT_MS);
    if (res.ok) {
      const rawAgentsPayload = await res.json();
      const rawAgents = Array.isArray(rawAgentsPayload) ? rawAgentsPayload : [];
      await syncConversationSessions(rawAgents, {
        selectedRunId: options.selectedRunId,
      });
      records = await readPersistedEventRecords(options);
      const scopedWorkers = selectedRunWorkers(records, options);
      agentsData = buildLiveWorkerSnapshots({
        agents: filterRuntimeAgentsForWorkers(rawAgents, scopedWorkers),
        workers: scopedWorkers,
        runs: records.allRuns,
      });
    } else {
      const bridgeError = new Error(`Agent runtime list request failed with status ${res.status}.`);
      agentsData = buildLiveWorkerSnapshots({
        workers: selectedRunWorkers(records, options),
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
      workers: selectedRunWorkers(records, options),
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

  return buildEventPayload(records, agentsData, frontendErrors, options);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req, {
    source: "Events",
    action: "Stream live updates",
  });
  if (auth.response) {
    return auth.response;
  }

  const eventPayloadOptions = {
    selectedRunId: req.nextUrl.searchParams.get("runId"),
  } satisfies EventPayloadOptions;

  if (req.nextUrl.searchParams.get("snapshot") === "1") {
    const persistedOnly = req.nextUrl.searchParams.get("persisted") === "1";
    if (persistedOnly) {
      return NextResponse.json(await buildPersistedEventPayload(eventPayloadOptions));
    }

    await ensureSupervisorRuntimeStarted();
    const payload = await buildRuntimeEnrichedEventPayload(eventPayloadOptions);
    return NextResponse.json(payload);
  }

  await ensureSupervisorRuntimeStarted();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      let lastUpdatePayload = "";

      const sendSerializedEvent = (event: string, serializedData: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${serializedData}\n\n`));
        } catch {
          // Stream might be closed
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendEvent = (event: string, data: any) => {
        sendSerializedEvent(event, JSON.stringify(data));
      };
      const sendHeartbeat = () => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Stream might be closed
        }
      };
      const sendUpdateIfChanged = (payload: Awaited<ReturnType<typeof buildPersistedEventPayload>>) => {
        const serializedPayload = JSON.stringify(payload);
        if (serializedPayload === lastUpdatePayload) {
          sendHeartbeat();
          return;
        }

        lastUpdatePayload = serializedPayload;
        sendSerializedEvent("update", serializedPayload);
      };

      req.signal.addEventListener("abort", () => {
        isClosed = true;
      });

      while (!isClosed) {
        const notificationVersionAtStart = getEventStreamNotificationVersion();
        try {
          const runtimePayloadPromise = buildRuntimeEnrichedEventPayload(eventPayloadOptions);
          const runtimePayload = await Promise.race([
            runtimePayloadPromise,
            delay(RUNTIME_AGENT_GRACE_MS).then(() => null),
          ]);

          if (runtimePayload) {
            sendUpdateIfChanged(runtimePayload);
          } else {
            sendUpdateIfChanged(await buildPersistedEventPayload(eventPayloadOptions));
            const enrichedPayload = await runtimePayloadPromise;
            if (!isClosed) {
              sendUpdateIfChanged(enrichedPayload);
            }
          }
        } catch (e) {
          console.error("SSE Poll Error", e);
          sendEvent("update_error", buildAppError(e, {
            source: "Events",
            action: "Stream live updates",
          }));
        }

        if (!isClosed) {
          await waitForEventStreamNotification(STREAM_REFRESH_INTERVAL_MS, notificationVersionAtStart);
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
