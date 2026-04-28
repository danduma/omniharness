import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { messages, plans, runs, accounts, workers, clarifications, validationRuns, executionEvents, supervisorInterventions } from "@/server/db/schema";
import { BRIDGE_URL } from "@/server/bridge-client";
import { buildAppError } from "@/server/api-errors";
import { desc } from "drizzle-orm";
import { syncConversationSessions } from "@/server/conversations/sync";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
import { waitForEventStreamNotification } from "@/server/events/live-updates";

export const dynamic = "force-dynamic";

const STREAM_POLL_INTERVAL_MS = 1000;
const BRIDGE_AGENT_GRACE_MS = 150;
const BRIDGE_AGENT_TIMEOUT_MS = 750;

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      fetch(url, { signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Bridge agent list request timed out after ${timeoutMs}ms.`));
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
    allClarifications,
    allValidationRuns,
    allExecutionEvents,
    allSupervisorInterventions,
  };
}

function buildEventPayload(
  records: Awaited<ReturnType<typeof readPersistedEventRecords>>,
  agentsData = buildLiveWorkerSnapshots({
    workers: records.allWorkers,
    runs: records.allRuns,
  }),
  frontendErrors: unknown[] = [],
) {
  return {
    messages: records.msgs,
    plans: records.allPlans,
    runs: records.allRuns,
    accounts: records.allAccounts,
    agents: agentsData,
    workers: records.allWorkers,
    clarifications: records.allClarifications,
    validationRuns: records.allValidationRuns,
    executionEvents: records.allExecutionEvents,
    supervisorInterventions: records.allSupervisorInterventions,
    frontendErrors,
  };
}

async function buildPersistedEventPayload() {
  const records = await readPersistedEventRecords();
  return buildEventPayload(records);
}

async function buildBridgeEnrichedEventPayload() {
  let records = await readPersistedEventRecords();
  let agentsData = buildLiveWorkerSnapshots({
    workers: records.allWorkers,
    runs: records.allRuns,
  });
  const frontendErrors = [];

  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/agents`, BRIDGE_AGENT_TIMEOUT_MS);
    if (res.ok) {
      const rawAgents = await res.json();
      await syncConversationSessions(rawAgents);
      records = await readPersistedEventRecords();
      agentsData = buildLiveWorkerSnapshots({
        agents: rawAgents,
        workers: records.allWorkers,
        runs: records.allRuns,
      });
    } else {
      const bridgeError = new Error(`Bridge agent list request failed with status ${res.status}.`);
      agentsData = buildLiveWorkerSnapshots({
        workers: records.allWorkers,
        runs: records.allRuns,
        bridgeError,
      });
      frontendErrors.push(buildAppError(
        bridgeError,
        {
          source: "Bridge",
          action: "Stream live agent state",
        },
      ));
    }
  } catch (error) {
    agentsData = buildLiveWorkerSnapshots({
      workers: records.allWorkers,
      runs: records.allRuns,
      bridgeError: error,
    });
    frontendErrors.push(buildAppError(error, {
      source: "Bridge",
      action: "Stream live agent state",
    }));
  }

  return buildEventPayload(records, agentsData, frontendErrors);
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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      let isClosed = false;
      req.signal.addEventListener("abort", () => {
        isClosed = true;
      });

      while (!isClosed) {
        try {
          const bridgePayloadPromise = buildBridgeEnrichedEventPayload();
          const bridgePayload = await Promise.race([
            bridgePayloadPromise,
            delay(BRIDGE_AGENT_GRACE_MS).then(() => null),
          ]);

          if (bridgePayload) {
            sendEvent("update", bridgePayload);
          } else {
            sendEvent("update", await buildPersistedEventPayload());
            const enrichedPayload = await bridgePayloadPromise;
            if (!isClosed) {
              sendEvent("update", enrichedPayload);
            }
          }
        } catch (e) {
          console.error("SSE Poll Error", e);
          sendEvent("update_error", buildAppError(e, {
            source: "Events",
            action: "Stream live updates",
          }));
        }

        // Wait before next poll
        if (!isClosed) {
          await waitForEventStreamNotification(STREAM_POLL_INTERVAL_MS);
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
