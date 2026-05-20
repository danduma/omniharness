import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  clarifications,
  executionEvents,
  messages,
  planItems,
  plans,
  queuedConversationMessages,
  conversationReadMarkers,
  recoveryIncidents,
  runs,
  processSessions,
  supervisorInterventions,
  workers,
} from "@/server/db/schema";
import { serializeMessageRecord } from "@/server/conversations/message-records";
import { isTerminalRunStatus } from "@/lib/run-status";
import type { EventStreamState } from "@/app/home/types";
import { normalizeChatAttachments } from "@/lib/chat-attachments";
import { readWorkerLatestSeq } from "@/server/workers/output-store";
import type { BusyMessageAction } from "@/app/home/busy-message-behavior";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import { withEventPayloadChecksum } from "@/server/events/payload-checksum";
import { buildAwaitingUserQuestionInvariantErrors } from "@/server/events/lifecycle-invariants";
import { serializeSessionRecord } from "@/server/session-providers/session-records";
import { reconcileOrphanedProcessSessions } from "@/server/session-providers/process-store";

const EXECUTION_EVENT_LIMIT = 100;
const WORKER_INITIAL_PROMPT_PREVIEW_LIMIT = 1_000;
const EXECUTION_EVENT_DETAIL_LIMIT = 1_000;
const SUPERVISOR_INTERVENTION_TEXT_LIMIT = 2_000;

export type EventPayloadOptions = {
  selectedRunId?: string | null;
};

function truncateText(value: string | null | undefined, limit: number) {
  if (!value || value.length <= limit) {
    return value ?? "";
  }

  return `${value.slice(0, limit)}

[Truncated ${value.length - limit} characters in live payload]`;
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

type CompactWorkerRecord = Pick<
  typeof workers.$inferSelect,
  "id" | "runId" | "type" | "status" | "workerNumber" | "title" | "initialPrompt" | "createdAt" | "updatedAt"
>;

const WORKER_SNAPSHOT_COLUMNS = {
  id: workers.id,
  runId: workers.runId,
  type: workers.type,
  status: workers.status,
  workerNumber: workers.workerNumber,
  title: workers.title,
  initialPrompt: workers.initialPrompt,
  activeWorkStartedAt: workers.activeWorkStartedAt,
  activeWorkDurationMs: workers.activeWorkDurationMs,
  createdAt: workers.createdAt,
  updatedAt: workers.updatedAt,
};

function compactWorkerRecord(worker: CompactWorkerRecord) {
  return {
    id: worker.id,
    runId: worker.runId,
    type: worker.type,
    status: worker.status,
    workerNumber: worker.workerNumber,
    title: worker.title,
    initialPrompt: truncateText(worker.initialPrompt, WORKER_INITIAL_PROMPT_PREVIEW_LIMIT),
    createdAt: worker.createdAt.toISOString(),
    updatedAt: worker.updatedAt.toISOString(),
  };
}

function serializeRunRecord(run: typeof runs.$inferSelect) {
  return {
    ...run,
    sessionType: run.sessionType === "process" ? "process" as const : "omni" as const,
    mode: run.mode as ConversationModeOption | null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt?.toISOString() ?? null,
    failedAt: run.failedAt?.toISOString() ?? null,
    archivedAt: run.archivedAt?.toISOString() ?? null,
  };
}

function compactExecutionEvent(event: typeof executionEvents.$inferSelect) {
  return {
    ...event,
    details: compactExecutionEventDetails(event.details),
    createdAt: event.createdAt.toISOString(),
  };
}

function compactSupervisorIntervention(intervention: typeof supervisorInterventions.$inferSelect) {
  return {
    ...intervention,
    prompt: truncateText(intervention.prompt, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
    summary: truncateText(intervention.summary, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
    createdAt: intervention.createdAt.toISOString(),
  };
}

function compactRecoveryIncident(incident: typeof recoveryIncidents.$inferSelect) {
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
    detectedAt: incident.detectedAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
  };
}

function deriveRecoveryState(incidents: Array<typeof recoveryIncidents.$inferSelect>) {
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

function serializeQueuedConversationMessage(record: typeof queuedConversationMessages.$inferSelect) {
  return {
    id: record.id,
    runId: record.runId,
    targetWorkerId: record.targetWorkerId,
    action: record.action as BusyMessageAction,
    content: record.content,
    status: record.status as "pending" | "delivering" | "delivered" | "cancelled" | "failed",
    lastError: record.lastError,
    attachments: normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
  };
}

export async function buildPersistedEventPayload(options: EventPayloadOptions = {}): Promise<EventStreamState> {
  await reconcileOrphanedProcessSessions();
  const selectedRunId = options.selectedRunId?.trim() || null;
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt), desc(plans.id));
  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt), desc(runs.id));
  const selectedRun = selectedRunId ? allRuns.find((run) => run.id === selectedRunId) ?? null : null;
  const selectedPlanId = selectedRun?.planId ?? null;
  const transcriptRunIds = selectedRunId
    ? [
        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
        selectedRunId,
      ]
    : [];

  const runIds = selectedRunId ? new Set([selectedRunId]) : null;
  const planIds = runIds ? new Set(allRuns.filter((run) => runIds.has(run.id)).map((run) => run.planId)) : null;
  const selectedRunScoped = <T extends { runId: string }>(records: T[]) => (
    runIds ? records.filter((record) => runIds.has(record.runId)) : []
  );
  const selectedPlanScoped = <T extends { planId: string }>(records: T[]) => (
    planIds ? records.filter((record) => planIds.has(record.planId)) : []
  );

  const [
    msgs,
    allAccounts,
    allWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allProcessSessions,
    allReadMarkers,
  ] = await Promise.all([
    selectedRunId
      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt), asc(messages.id))
      : [],
    db.select().from(accounts),
    selectedRunId
      ? db.select(WORKER_SNAPSHOT_COLUMNS).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
      : db.select(WORKER_SNAPSHOT_COLUMNS).from(workers).orderBy(asc(workers.createdAt), asc(workers.id)),
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
    db.select().from(processSessions),
    db.select().from(conversationReadMarkers).where(allRuns.length > 0 ? inArray(conversationReadMarkers.runId, allRuns.map((run) => run.id)) : eq(conversationReadMarkers.runId, "__none__")),
  ]);
  const processSessionsByRunId = new Map(allProcessSessions.map((session) => [session.runId, session]));
  const workersByRunId = new Map<string, typeof allWorkers[number]>();
  for (const worker of allWorkers) {
    if (!workersByRunId.has(worker.runId)) {
      workersByRunId.set(worker.runId, worker);
    }
  }
  const sessions = allRuns.map((run) => serializeSessionRecord({
    run,
    primaryWorker: workersByRunId.get(run.id) ?? null,
    processSession: processSessionsByRunId.get(run.id) ?? null,
  }));
  const selectedWorkerEntryResults = selectedRunId
    ? await Promise.all(
      allWorkers
        .filter((worker) => worker.runId === selectedRunId)
        .map(async (worker) => {
          const latestSeq = await readWorkerLatestSeq(selectedRunId, worker.id);
          return { workerId: worker.id, latestSeq };
        }),
    )
    : [];
  const selectedWorkerEntrySeqs = Object.fromEntries(
    selectedWorkerEntryResults
      .filter((result) => result.latestSeq > 0)
      .map((result) => [result.workerId, result.latestSeq] as const),
  );
  const lifecycleErrors = buildAwaitingUserQuestionInvariantErrors({
    runs: allRuns,
    messages: msgs,
    selectedRunId,
  });
  const readMarkers = Object.fromEntries(
    allReadMarkers.map((marker) => [marker.runId, marker.lastReadAt.toISOString()]),
  );

  return withEventPayloadChecksum({
    messages: msgs.map(serializeMessageRecord).filter((message): message is NonNullable<typeof message> => Boolean(message)),
    readMarkers,
    plans: allPlans,
    runs: allRuns.map(serializeRunRecord),
    sessions,
    accounts: allAccounts,
    agents: [],
    workers: allWorkers.map(compactWorkerRecord),
    planItems: selectedPlanScoped(allPlanItems),
    clarifications: selectedRunScoped(allClarifications),
    executionEvents: selectedRunScoped(allExecutionEvents).slice(0, EXECUTION_EVENT_LIMIT).map(compactExecutionEvent),
    supervisorInterventions: selectedRunScoped(allSupervisorInterventions).map(compactSupervisorIntervention),
    queuedMessages: selectedRunScoped(allQueuedMessages)
      .filter((message) => message.status === "pending" || message.status === "delivering")
      .map(serializeQueuedConversationMessage),
    recoveryIncidents: selectedRunScoped(allRecoveryIncidents).map(compactRecoveryIncident),
    recoveryState: runIds && !isTerminalRunStatus(selectedRun?.status)
      ? deriveRecoveryState(allRecoveryIncidents)
      : null,
    frontendErrors: lifecycleErrors,
    snapshotRunId: selectedRunId ?? null,
    messageScope: {
      runIds: transcriptRunIds,
      complete: true,
    },
    workerEntrySeqs: selectedWorkerEntrySeqs,
  });
}
