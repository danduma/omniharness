import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { messages, plans, runs, accounts, workers, planItems, clarifications, validationRuns, executionEvents, supervisorInterventions } from "@/server/db/schema";
import { BRIDGE_URL } from "@/server/bridge-client";
import { buildAppError } from "@/server/api-errors";
import { desc } from "drizzle-orm";
import { syncConversationSessions } from "@/server/conversations/sync";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
import { waitForEventStreamNotification } from "@/server/events/live-updates";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { serializeMessageRecord } from "@/server/conversations/message-records";

export const dynamic = "force-dynamic";

const STREAM_REFRESH_INTERVAL_MS = 15_000;
const RUNTIME_AGENT_GRACE_MS = 150;
const RUNTIME_AGENT_TIMEOUT_MS = 5000;

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

async function readPersistedEventRecords() {
  const msgs = await db.select().from(messages).orderBy(messages.createdAt);
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt));
  const allRuns = await db.select().from(runs).orderBy(desc(runs.createdAt));
  const allAccounts = await db.select().from(accounts);
  const allWorkers = await db.select().from(workers);
  const allPlanItems = await db.select().from(planItems);
  const allClarifications = await db.select().from(clarifications).orderBy(desc(clarifications.createdAt));
  const allValidationRuns = await db.select().from(validationRuns).orderBy(desc(validationRuns.createdAt));
  const allExecutionEvents = await db.select().from(executionEvents).orderBy(desc(executionEvents.createdAt));
  const allSupervisorInterventions = await db.select().from(supervisorInterventions).orderBy(desc(supervisorInterventions.createdAt));

  return {
    msgs,
    allPlans,
    allRuns,
    allAccounts,
    allWorkers,
    allPlanItems,
    allClarifications,
    allValidationRuns,
    allExecutionEvents,
    allSupervisorInterventions,
  };
}


type EventPayloadOptions = {
  selectedRunId?: string | null;
};

type PersistedEventRecords = Awaited<ReturnType<typeof readPersistedEventRecords>>;

const WORKER_INITIAL_PROMPT_PREVIEW_LIMIT = 1_000;
const AGENT_TEXT_FIELD_LIMIT = 4_000;
const AGENT_ENTRY_TEXT_LIMIT = 2_000;
const AGENT_OUTPUT_ENTRY_LIMIT = 24;
const EXECUTION_EVENT_LIMIT = 100;
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

  return records.allWorkers.filter((worker) => worker.runId === selectedRunId);
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

    for (const key of ["summary", "reason", "error", "mode", "seconds"]) {
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

function compactAgentSnapshot(agent: ReturnType<typeof buildLiveWorkerSnapshots>[number]) {
  return {
    ...agent,
    outputEntries: (agent.outputEntries ?? []).slice(-AGENT_OUTPUT_ENTRY_LIMIT).map((entry) => ({
      id: entry.id,
      type: entry.type,
      text: truncateText(entry.text, AGENT_ENTRY_TEXT_LIMIT),
      timestamp: entry.timestamp,
      toolCallId: entry.toolCallId,
      toolKind: entry.toolKind,
      status: entry.status,
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
    messages: filterSelectedRunScopedRecords(records.msgs, runIds).map(serializeMessageRecord),
    plans: records.allPlans,
    runs: records.allRuns,
    accounts: records.allAccounts,
    agents: agentsData.map(compactAgentSnapshot),
    workers: records.allWorkers.map(compactWorkerRecord),
    planItems: filterSelectedPlanScopedRecords(records.allPlanItems, planIds),
    clarifications: filterSelectedRunScopedRecords(records.allClarifications, runIds),
    validationRuns: filterSelectedRunScopedRecords(records.allValidationRuns, runIds),
    executionEvents: filterSelectedRunScopedRecords(records.allExecutionEvents, runIds)
      .slice(0, EXECUTION_EVENT_LIMIT)
      .map(compactExecutionEvent),
    supervisorInterventions: filterSelectedRunScopedRecords(records.allSupervisorInterventions, runIds)
      .map(compactSupervisorIntervention),
    frontendErrors,
  };
}

async function buildPersistedEventPayload(options: EventPayloadOptions = {}) {
  const records = await readPersistedEventRecords();
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
  let records = await readPersistedEventRecords();
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
      await syncConversationSessions(rawAgents);
      records = await readPersistedEventRecords();
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

  await ensureSupervisorRuntimeStarted();

  const eventPayloadOptions = {
    selectedRunId: req.nextUrl.searchParams.get("runId"),
  } satisfies EventPayloadOptions;

  if (req.nextUrl.searchParams.get("snapshot") === "1") {
    const payload = req.nextUrl.searchParams.get("persisted") === "1"
      ? await buildPersistedEventPayload(eventPayloadOptions)
      : await buildRuntimeEnrichedEventPayload(eventPayloadOptions);
    return NextResponse.json(payload);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      let lastUpdatePayload = "";
      let lastRuntimeEnrichedPayload: Awaited<ReturnType<typeof buildRuntimeEnrichedEventPayload>> | null = null;

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
        try {
          const runtimePayloadPromise = buildRuntimeEnrichedEventPayload(eventPayloadOptions);
          const runtimePayload = await Promise.race([
            runtimePayloadPromise,
            delay(RUNTIME_AGENT_GRACE_MS).then(() => null),
          ]);

          if (runtimePayload) {
            lastRuntimeEnrichedPayload = runtimePayload;
            sendUpdateIfChanged(runtimePayload);
          } else {
            if (!lastRuntimeEnrichedPayload) {
              sendUpdateIfChanged(await buildPersistedEventPayload(eventPayloadOptions));
            }
            const enrichedPayload = await runtimePayloadPromise;
            if (!isClosed) {
              lastRuntimeEnrichedPayload = enrichedPayload;
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
          await waitForEventStreamNotification(STREAM_REFRESH_INTERVAL_MS);
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
