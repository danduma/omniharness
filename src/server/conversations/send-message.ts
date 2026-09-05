import { randomUUID } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { askAgent, cancelAgent, getAgent, respondElicitation, spawnAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import {
  clarifications,
  messages,
  queuedConversationMessages,
  runs,
  workerCredentialAllocations,
  workers,
} from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { answerClarification } from "@/server/clarifications/store";
import { resumeRunAfterClarification } from "@/server/clarifications/loop";
import { startSupervisorRun } from "@/server/supervisor/start";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { appendWorkerSessionMetadata, readWorkerSessionMetadata } from "@/server/workers/session-metadata";
import { buildTranscriptReplayPrompt, canRecreateRejectedSavedSession, isRejectedSavedSessionErrorMessage, materializeProviderSessionFromWorkerStream } from "@/server/workers/session-recovery";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { resolveWorkerLaunchSelection } from "@/server/workers/launch-selection";
import { readWorkerAllocatedAccountId } from "@/server/workers/allocated-account";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { appendAttachmentContext, normalizeChatAttachments, parseChatAttachmentsJson, resolveImageAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { getAppDataPath } from "@/server/app-root";
import { normalizeWorkerType, SUPPORTED_WORKER_TYPES, type SupportedWorkerType } from "@/server/supervisor/worker-types";
import { createQueuedConversationMessage, type BusyMessageAction } from "./queued-messages";
import { interruptWithDraftMessage, preemptRecoveryForInterrupt } from "./queued-message-interrupt";
import { serializeMessageRecord } from "./message-records";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import {
  hasLiveWorkerTurn,
  isWorkerTurnAbortedError,
  isWorkerTurnGenerationCurrent,
  isWorkerTurnSupersededError,
  runConversationMutation,
  runDetachedFromConversationMutation,
  runWorkerTurn,
  trackConversationBackgroundTask,
} from "./worker-turn-gate";
import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
import { isManualStopCommand } from "@/interface/home/busy-message-behavior";
import { emitNamedEvent } from "@/server/events/named-events";
import { cancelSupervisorWake } from "@/server/supervisor/wake";
import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
import { stopRunObserver } from "@/server/supervisor/observer";
import { buildDirectWorkerPrompt } from "./direct-worker-prompt";
import { extractQuotaResetInfo } from "@/server/quota/reset-parser";
import { handleWorkerQuotaExhaustion } from "@/server/quota/recovery";
import { runQuotaRecoveryMutation } from "@/server/quota/recovery-mutation";
import { reconcileRecoveredHumanInputEntries } from "@/server/workers/human-input-entries";
import { resolveRecoveryIncidentsAfterHealthyTurn } from "@/server/runs/recovery-incidents";
import {
  isProviderSessionDiagnosticErrorMessage,
  userFacingProviderSessionErrorMessage,
} from "@/server/workers/session-recovery";
import { recreateWorkerFromTranscript, type WorkerRecreationSelection } from "@/server/workers/provider-session-recovery";
import { decodeClaudeGatewayModel } from "@/lib/claude-model-gateway";
import { hasVerifiedDeadCredentialMarker, isAuthShapedProviderFailure } from "@/lib/provider-account-failures";
import { resolveCredentialAuthFailureMessage } from "./credential-auth-failure";
import { assertDirectRunWorkerTypeInvariant } from "@/server/workers/direct-run-type-invariant";
import { assertRunNotHandoffFenced } from "@/server/handoff/fence";

type RunRecord = typeof runs.$inferSelect;
type WorkerRecord = typeof workers.$inferSelect;
type DirectWorkerSnapshot = Awaited<ReturnType<typeof getAgent>>;
type ElicitationSchema = NonNullable<DirectWorkerSnapshot["pendingElicitations"]>[number]["requestedSchema"];
type ElicitationContent = Record<string, string | number | boolean | string[]>;

function isDirectRunMode(mode: string | null | undefined) {
  return mode === "direct" || mode === "commit";
}

// An Omni run is stored as mode "implementation" for its whole life; its
// `phase` distinguishes the interactive planning stage (planner worker, no
// supervisor) from the supervised implementation stage. Route follow-up
// messages by phase, not raw mode, so a reply during planning reaches the
// planner instead of being treated as a supervisor steer.
function isPlanningRun(run: { mode?: string | null; phase?: string | null }) {
  return run.mode === "planning" || (run.mode === "implementation" && run.phase === "planning");
}

function isSupervisedRun(run: { mode?: string | null; phase?: string | null }) {
  return run.mode === "implementation" && run.phase !== "planning";
}

function isAgentBusyError(error: unknown) {
  return /\bagent is busy\b/i.test(formatErrorMessage(error));
}

async function handleDirectWorkerQuotaError(args: {
  run: RunRecord;
  worker: WorkerRecord;
  error: unknown;
}) {
  const quotaInfo = extractQuotaResetInfo(args.error, { provider: args.worker.type });
  if (!quotaInfo.isQuotaError) {
    return false;
  }

  await handleWorkerQuotaExhaustion({
    runId: args.run.id,
    workerId: args.worker.id,
    text: quotaInfo.rawText,
    provider: args.worker.type,
  });
  notifyEventStreamSubscribers();
  return true;
}

function isAgentNotFoundError(error: unknown) {
  return /\b(agent not found|not_found|session not found|invalid session identifier|failed to load resumed session data from file|404)\b/i.test(formatErrorMessage(error));
}

function isAgentAlreadyExistsError(error: unknown, workerId: string) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("agent already exists") && message.includes(workerId.toLowerCase());
}

function normalizeWorkerStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function isWorkerCancelled(worker: WorkerRecord | null | undefined) {
  const status = normalizeWorkerStatus(worker?.status);
  return status === "cancelled" || status === "canceled";
}

function isRunCancelled(run: RunRecord | null | undefined) {
  const status = normalizeWorkerStatus(run?.status);
  return status === "cancelled" || status === "canceled";
}

function workerTurnSupersededError(workerId: string) {
  return Object.assign(
    new Error(`Worker turn superseded by a newer worker turn: ${workerId}`),
    { code: "WORKER_TURN_SUPERSEDED", status: 409, retryable: false },
  );
}

function isStoppableRunStatus(status: string | null | undefined) {
  return ["running", "working", "stuck", "needs_recovery"].includes(normalizeWorkerStatus(status));
}

function isStoppableWorkerStatus(status: string | null | undefined) {
  return ["starting", "working", "idle", "stuck"].includes(normalizeWorkerStatus(status));
}

function workerCreatedAtMs(worker: WorkerRecord) {
  const createdAt = worker.createdAt;
  const value = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function compareWorkersForFollowUp(a: WorkerRecord, b: WorkerRecord) {
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

async function selectConversationWorker(runId: string) {
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const sortedWorkers = [...runWorkers].sort(compareWorkersForFollowUp);
  return sortedWorkers.find((worker) => !isWorkerCancelled(worker)) ?? sortedWorkers[0] ?? null;
}

function isDirectWorkerSelectionSwitchable(worker: WorkerRecord) {
  return ["cancelled", "canceled", "done", "error", "failed", "idle", "stopped"].includes(normalizeWorkerStatus(worker.status));
}

async function reconcileDirectWorkerSelection(args: {
  run: RunRecord;
  worker: WorkerRecord;
  nextUserPrompt: string;
}) {
  const requestedType = args.run.preferredWorkerType?.trim() || args.worker.type;
  const requestedModel = args.run.preferredWorkerModel?.trim() || null;
  const requestedEffort = args.run.preferredWorkerEffort?.trim().toLowerCase() || null;
  const requestedAccountId = args.run.preferredWorkerAccountId?.trim() || null;
  const currentAllocation = await db
    .select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, args.worker.id))
    .get();
  const currentModel = args.worker.effectiveLaunchModel?.trim() || null;
  const currentEffort = args.worker.effectiveLaunchEffort?.trim().toLowerCase() || null;
  const typeChanged = normalizeWorkerType(args.worker.type) !== normalizeWorkerType(requestedType);
  if (typeChanged) {
    assertDirectRunWorkerTypeInvariant({
      run: args.run,
      existingWorkerTypes: [args.worker.type],
      requestedWorkerType: requestedType,
    });
  }
  const modelChanged = Boolean(currentModel && requestedModel && currentModel !== requestedModel);
  const effortChanged = Boolean(currentEffort && requestedEffort && currentEffort !== requestedEffort);
  const accountChanged = Boolean(
    requestedAccountId
    && currentAllocation?.accountId
    && requestedAccountId !== currentAllocation.accountId,
  );

  if (!typeChanged && !modelChanged && !effortChanged && !accountChanged) {
    return null;
  }

  if (!isDirectWorkerSelectionSwitchable(args.worker)) {
    await recordExecutionEvent({
      runId: args.run.id,
      workerId: args.worker.id,
      planItemId: null,
      eventType: "worker_selection_deferred",
      details: {
        summary: `Deferred the ${requestedType} selection until ${args.worker.id} is idle.`,
        previousWorkerType: args.worker.type,
        nextWorkerType: requestedType,
        reason: "worker_turn_active",
      },
    });
    emitNamedEvent({
      kind: "worker.selection_deferred",
      runId: args.run.id,
      workerId: args.worker.id,
      requestedType,
      reason: "worker_turn_active",
    });
    return null;
  }

  const selection: WorkerRecreationSelection = {
    type: requestedType,
    model: requestedModel,
    effort: requestedEffort,
    accountId: requestedAccountId,
    credentialSource: decodeClaudeGatewayModel(requestedModel) ? "gateway" : "account",
  };

  try {
    const recreated = await recreateWorkerFromTranscript({
      run: args.run,
      worker: args.worker,
      nextUserPrompt: args.nextUserPrompt,
      source: "direct-follow-up",
      reason: "direct_worker_selection_changed",
      selection,
      expectedTurnGeneration: args.worker.turnGeneration,
    });
    await recordExecutionEvent({
      runId: args.run.id,
      workerId: args.worker.id,
      planItemId: null,
      eventType: "worker_selection_reconciled",
      details: {
        summary: `Recreated ${args.worker.id} to honor the selected ${requestedType} worker.`,
        previousWorkerType: args.worker.type,
        nextWorkerType: requestedType,
        previousWorkerModel: currentModel,
        nextWorkerModel: requestedModel,
        previousWorkerEffort: currentEffort,
        nextWorkerEffort: requestedEffort,
        previousAccountId: currentAllocation?.accountId ?? null,
        nextAccountId: requestedAccountId,
      },
    });
    const worker = await db.select().from(workers).where(eq(workers.id, args.worker.id)).get();
    return {
      worker: worker ?? args.worker,
      replayPrompt: recreated.replayPrompt,
    };
  } catch (error) {
    if (isWorkerTurnSupersededError(error)) {
      throw error;
    }
    await db.update(workers).set({
      status: "error",
      updatedAt: new Date(),
    }).where(eq(workers.id, args.worker.id));
    await persistRunFailure(args.run.id, error);
    emitNamedEvent({
      kind: "error.surfaced",
      code: "worker.resume.failed",
      message: `Could not switch ${args.worker.id} to the selected ${requestedType} worker: ${formatErrorMessage(error)}`,
      surface: "banner",
      runId: args.run.id,
      workerId: args.worker.id,
      cause: error instanceof Error ? { name: error.name, message: error.message } : null,
    });
    throw error;
  }
}

function elicitationAnswerContent(text: string, requestedSchema: ElicitationSchema | null | undefined): ElicitationContent {
  const properties = requestedSchema?.properties ?? {};
  const propertyNames = Object.keys(properties);
  if (propertyNames.includes("customAnswer")) {
    return { customAnswer: text };
  }

  const nonCustomFields = propertyNames.filter((name) => name !== "customAnswer");
  if (nonCustomFields.length === 1 && nonCustomFields[0]) {
    return { [nonCustomFields[0]]: text };
  }

  return { response: text };
}

async function answerDirectWorkerElicitation(args: {
  run: RunRecord;
  worker: WorkerRecord;
  userText: string;
  workerText: string;
  attachments: ChatAttachment[];
  attachmentsJson: string | null;
  messageId: string;
}) {
  const snapshot = await Promise.resolve(getAgent(args.worker.id)).catch(() => null);
  const elicitation = snapshot?.pendingElicitations?.[0] ?? null;
  if (!elicitation) {
    return null;
  }

  const createdAt = new Date();
  const userMessage = {
    id: args.messageId,
    runId: args.run.id,
    role: "user",
    kind: "checkpoint",
    content: args.userText,
    attachmentsJson: args.attachmentsJson,
    createdAt,
  };

  await activateRunAndPersistMessage({
    run: args.run,
    nextStatus: "running",
    activatedAt: createdAt,
    workerFence: {
      workerId: args.worker.id,
      expectedTurnGeneration: args.worker.turnGeneration,
      allowCancelled: false,
    },
    persist: async () => {
      await appendUserInputOnDelivery({
        id: userMessage.id,
        runId: args.run.id,
        workerId: args.worker.id,
        text: args.userText,
        deliveredAt: createdAt,
        attachments: args.attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
          storagePath: attachment.storagePath,
        })),
      });
      await db.insert(messages).values(userMessage);
      await respondElicitation(args.worker.id, {
        action: "accept",
        content: elicitationAnswerContent(args.workerText || args.userText, elicitation.requestedSchema),
      });
      await db.update(workers).set({
        status: "working",
        updatedAt: createdAt,
      }).where(and(
        eq(workers.id, args.worker.id),
        eq(workers.turnGeneration, args.worker.turnGeneration),
      ));
    },
  });
  emitNamedEvent({
    kind: "worker.status",
    runId: args.run.id,
    workerId: args.worker.id,
    prev: args.worker.status,
    next: "working",
  });
  await recordExecutionEvent({
    runId: args.run.id,
    workerId: args.worker.id,
    planItemId: null,
    eventType: "direct_worker_elicitation_answered",
    details: {
      summary: `Answered pending worker question for ${args.worker.id}.`,
      requestId: elicitation.requestId,
    },
    createdAt,
  });
  notifyEventStreamSubscribers();
  return userMessage;
}

async function retireMatchingQueuedDirectAnswers(args: {
  runId: string;
  workerId: string;
  content: string;
  attachmentsJson: string | null;
  answeredAt: Date;
}) {
  const expectedAttachmentsJson = serializeChatAttachments(parseChatAttachmentsJson(args.attachmentsJson));
  const queuedRows = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, args.runId));
  const matchingRows = queuedRows.filter((row) => (
    (row.status === "pending" || row.status === "delivering")
    && (row.targetWorkerId === args.workerId || row.targetWorkerId === null)
    && row.content === args.content
    && serializeChatAttachments(parseChatAttachmentsJson(row.attachmentsJson)) === expectedAttachmentsJson
  ));

  for (const row of matchingRows) {
    await db.update(queuedConversationMessages).set({
      status: "cancelled",
      lastError: "Answered directly before queued delivery.",
      updatedAt: args.answeredAt,
    }).where(eq(queuedConversationMessages.id, row.id));
    await recordExecutionEvent({
      runId: args.runId,
      workerId: row.targetWorkerId ?? args.workerId,
      planItemId: null,
      eventType: "queued_message_cancelled",
      details: {
        summary: "Cancelled queued duplicate after the answer was delivered directly.",
        queuedMessageId: row.id,
        reason: "direct_answer_delivered",
      },
      createdAt: args.answeredAt,
    });
  }
}

/**
 * Reconcile the DB user-message list against the worker output stream.
 *
 * Historically this asserted the invariant and threw a 409 if any DB row
 * was missing from the stream. That surfaced as "Previous message is
 * still being persisted..." in the UI whenever the send-message flow
 * crashed between the DB insert and the stream write — and the only way
 * out was to hand-edit the DB.
 *
 * New contract: if a row is missing, silently backfill the stream entry
 * from the DB row. The stream is append-only and the user_input entry is
 * keyed by the message id, so the write is idempotent. We never block
 * the caller on this — at worst we log the failure and continue.
 */
export async function reconcileWorkerUserMessagesInStream(runId: string, workerId: string) {
  const [storedUserMessages, entries] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(and(eq(messages.runId, runId), eq(messages.role, "user")))
      .orderBy(asc(messages.createdAt), asc(messages.id)),
    readWorkerOutputEntries(runId, workerId),
  ]);
  const streamUserInputIds = new Set(
    entries
      .filter((entry) => (entry as { type?: string }).type === "user_input")
      .map((entry) => entry.id),
  );
  for (const message of storedUserMessages) {
    if (streamUserInputIds.has(message.id)) continue;
    try {
      await appendUserInputOnDelivery({
        id: message.id,
        runId,
        workerId,
        text: message.content ?? "",
        deliveredAt: message.createdAt instanceof Date
          ? message.createdAt
          : new Date(message.createdAt as unknown as string | number),
        attachments: parseChatAttachmentsJson(message.attachmentsJson).map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
          storagePath: attachment.storagePath,
        })),
      });
    } catch (error) {
      process.stderr.write(
        `[send-message] failed to backfill user_input for message ${message.id} on worker ${workerId}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
}

export async function resumeMissingDirectWorker(
  run: RunRecord,
  worker: WorkerRecord,
  expectedTurnGeneration?: number,
) {
  const workerPredicate = expectedTurnGeneration === undefined
    ? eq(workers.id, worker.id)
    : and(
      eq(workers.id, worker.id),
      eq(workers.turnGeneration, expectedTurnGeneration),
    );
  let sessionId = worker.bridgeSessionId?.trim();
  let sessionMode = worker.bridgeSessionMode?.trim();
  if (!sessionId) {
    const metadata = await readWorkerSessionMetadata(worker.runId, worker.id);
    if (metadata) {
      sessionId = metadata.sessionId;
      sessionMode = metadata.sessionMode ?? sessionMode;
      await db.update(workers).set({
        bridgeSessionId: metadata.sessionId,
        bridgeSessionMode: metadata.sessionMode ?? worker.bridgeSessionMode,
        updatedAt: new Date(),
      }).where(workerPredicate);
      emitNamedEvent({
        kind: "worker.session_metadata_repaired",
        runId: worker.runId,
        workerId: worker.id,
      });
    }
  }
  if (!sessionId) {
    const message = `Direct worker ${worker.id} is missing persisted ACP session metadata.`;
    emitNamedEvent({
      kind: "error.surfaced",
      code: "worker.resume.failed",
      message,
      surface: "banner",
      runId: run.id,
      workerId: worker.id,
      cause: null,
    });
    throw Object.assign(new Error(message), { status: 500 });
  }

  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(sessionMode, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();
  const launchSelection = resolveWorkerLaunchSelection(worker, run, {
    accountId: await readWorkerAllocatedAccountId(worker.id),
  });
  const spawnParams = {
    type: worker.type,
    cwd: worker.cwd,
    name: worker.id,
    ...(workerMode ? { mode: workerMode } : {}),
    env: envParams,
    ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
    ...(launchSelection.model ? { model: launchSelection.model } : {}),
    ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
  };
  let resumedWorker;
  let recreatedFromRejectedEmptySession = false;
  let transcriptReplayRequired = false;
  try {
    resumedWorker = await spawnAgent({
      ...spawnParams,
      resumeSessionId: sessionId,
    });
  } catch (error) {
    if (isAgentAlreadyExistsError(error, worker.id)) {
      resumedWorker = await getAgent(worker.id);
    } else if (
      isRejectedSavedSessionErrorMessage(formatErrorMessage(error))
      && await canRecreateRejectedSavedSession(run.id, worker.id)
    ) {
      await recordExecutionEvent({
        runId: run.id,
        workerId: worker.id,
        planItemId: null,
        eventType: "worker_session_missing",
        details: {
          summary: `Saved bridge session for ${worker.id} is not recoverable, and the worker stream has no provider transcript.`,
          sessionId,
          reason: formatErrorMessage(error),
        },
      });
      const startingWorker = await db.update(workers).set({
        status: "starting",
        bridgeSessionId: null,
        bridgeSessionMode: null,
        updatedAt: new Date(),
      }).where(workerPredicate).returning({ id: workers.id }).get();
      if (!startingWorker) {
        throw workerTurnSupersededError(worker.id);
      }
      resumedWorker = await spawnAgent(spawnParams);
      recreatedFromRejectedEmptySession = true;
    } else if (isRejectedSavedSessionErrorMessage(formatErrorMessage(error))) {
      const materialized = await materializeProviderSessionFromWorkerStream({
        runId: run.id,
        workerId: worker.id,
        type: worker.type,
        sessionId,
        cwd: worker.cwd,
        errorMessage: formatErrorMessage(error),
        env: envParams,
      });
      if (materialized) {
        await recordExecutionEvent({
          runId: run.id,
          workerId: worker.id,
          planItemId: null,
          eventType: "worker_session_materialized",
          details: {
            summary: `Materialized ${materialized.provider} session ${sessionId} from the saved OmniHarness transcript.`,
            provider: materialized.provider,
            sessionId,
            filePath: materialized.filePath,
            messageCount: materialized.messageCount,
          },
        });
        try {
          resumedWorker = await spawnAgent({
            ...spawnParams,
            resumeSessionId: sessionId,
          });
        } catch (materializedResumeError) {
          await recordExecutionEvent({
            runId: run.id,
            workerId: worker.id,
            planItemId: null,
            eventType: "worker_session_materialized_resume_failed",
            details: {
              summary: `Materialized ${materialized.provider} session ${sessionId}, but ACP resume still failed.`,
              provider: materialized.provider,
              sessionId,
              filePath: materialized.filePath,
              reason: formatErrorMessage(materializedResumeError),
            },
          });
        }
      }
      if (!resumedWorker) {
        await recordExecutionEvent({
          runId: run.id,
          workerId: worker.id,
          planItemId: null,
          eventType: "worker_session_missing",
          details: {
            summary: `Saved bridge session for ${worker.id} is not recoverable; continuing from the saved OmniHarness transcript.`,
            sessionId,
            reason: formatErrorMessage(error),
            transcriptReplay: true,
          },
        });
        const startingWorker = await db.update(workers).set({
          status: "starting",
          bridgeSessionId: null,
          bridgeSessionMode: null,
          updatedAt: new Date(),
        }).where(workerPredicate).returning({ id: workers.id }).get();
        if (!startingWorker) {
          throw workerTurnSupersededError(worker.id);
        }
        resumedWorker = await spawnAgent(spawnParams);
        transcriptReplayRequired = true;
      }
    } else {
      emitNamedEvent({
        kind: "error.surfaced",
        code: "worker.resume.failed",
        message: formatErrorMessage(error),
        surface: "banner",
        runId: run.id,
        workerId: worker.id,
        cause: error instanceof Error ? { name: error.name, message: error.message } : null,
      });
      throw error;
    }
  }

  const persistedWorker = await runQuotaRecoveryMutation(run.id, async () => {
    const currentRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
    if (!currentRun || isRunCancelled(currentRun)) {
      return false;
    }
    return Boolean(await db.update(workers).set({
      status: resumedWorker.state,
      bridgeSessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
      bridgeSessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
      updatedAt: new Date(),
    }).where(workerPredicate).returning({ id: workers.id }).get());
  });
  if (!persistedWorker) {
    await cancelAgent(worker.id).catch(() => undefined);
    throw workerTurnSupersededError(worker.id);
  }

  await recordExecutionEvent({
    runId: run.id,
    workerId: worker.id,
    planItemId: null,
    eventType: transcriptReplayRequired
      ? "worker_session_recreated_from_transcript"
      : recreatedFromRejectedEmptySession ? "worker_session_recreated" : "worker_session_resumed",
    details: {
      summary: transcriptReplayRequired
        ? `Started a fresh runtime worker for ${worker.id} and continued from the saved OmniHarness transcript.`
        : recreatedFromRejectedEmptySession
        ? `Started a fresh runtime worker for ${worker.id} after its empty saved session was rejected.`
        : `Resumed ${worker.id} from saved session`,
      rejectedSessionId: recreatedFromRejectedEmptySession || transcriptReplayRequired ? sessionId : null,
      sessionId: recreatedFromRejectedEmptySession || transcriptReplayRequired ? resumedWorker.sessionId ?? null : sessionId,
      transcriptReplay: transcriptReplayRequired,
    },
  });
  await reconcileRecoveredHumanInputEntries({
    runId: run.id,
    workerId: worker.id,
    activeElicitationRequestIds: (resumedWorker.pendingElicitations ?? []).map((entry) => entry.requestId),
    activePermissionRequestIds: (resumedWorker.pendingPermissions ?? []).map((entry) => entry.requestId),
    reason: "the worker was resumed for a follow-up and the recovered runtime no longer owns this request",
  });
  emitNamedEvent({
    kind: recreatedFromRejectedEmptySession || transcriptReplayRequired ? "worker.recreated" : "worker.reattached",
    runId: run.id,
    workerId: worker.id,
  });

  await appendWorkerSessionMetadata({
    runId: run.id,
    workerId: worker.id,
    sessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
    sessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    source: "direct-follow-up",
  });

  await persistWorkerSnapshot(worker.id, resumedWorker, { expectedTurnGeneration });
  notifyEventStreamSubscribers();
  return { ...resumedWorker, transcriptReplayRequired };
}

// A provider that blames the credential is usually just having a bad second.
// Retry the turn a couple of times before anyone concludes the account is dead.
const AUTH_RETRY_BACKOFF_MS = [2_000, 6_000];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * A 403/401 on a prompt aborts the turn before any work happens, so replaying
 * it is safe — and it is the single cheapest way to shake off the provider's
 * intermittent "Account suspended" answers.
 */
async function askAgentWithAuthRetry(
  workerId: string,
  prompt: string,
  imageAttachments?: Array<{ path: string; mimeType: string }>,
  expectedTurnGeneration?: number,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await (imageAttachments?.length
        ? askAgent(workerId, prompt, imageAttachments, { expectedTurnGeneration })
        : askAgent(workerId, prompt, undefined, { expectedTurnGeneration }));
    } catch (error) {
      const exhausted = attempt >= AUTH_RETRY_BACKOFF_MS.length;
      if (exhausted || !isAuthShapedProviderFailure(formatErrorMessage(error))) {
        throw error;
      }
      await sleep(AUTH_RETRY_BACKOFF_MS[attempt]);
    }
  }
}

async function askDirectWorkerWithResume(
  run: RunRecord,
  worker: WorkerRecord,
  content: string,
  imageAttachments?: Array<{ path: string; mimeType: string }>,
  promptOverride?: string | null,
  expectedTurnGeneration?: number,
) {
  const workerPrompt = promptOverride ?? (isDirectRunMode(run.mode) ? buildDirectWorkerPrompt(content) : content);
  try {
    return await askAgentWithAuthRetry(worker.id, workerPrompt, imageAttachments, expectedTurnGeneration);
  } catch (error) {
    if (isProviderSessionDiagnosticErrorMessage(formatErrorMessage(error))) {
      const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
      const recreated = await recreateWorkerFromTranscript({
        run,
        worker: currentWorker ?? worker,
        nextUserPrompt: workerPrompt,
        source: "direct-follow-up",
        reason: "provider_session_diagnostic_after_direct_follow_up",
        expectedTurnGeneration,
      });
      await db.update(workers).set({
        status: "working",
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      await db.update(runs).set({
        status: "running",
        failedAt: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
      notifyEventStreamSubscribers();

      try {
        return imageAttachments?.length
          ? await askAgent(worker.id, recreated.replayPrompt, imageAttachments, { expectedTurnGeneration })
          : await askAgent(worker.id, recreated.replayPrompt, undefined, { expectedTurnGeneration });
      } catch (retryError) {
        if (isProviderSessionDiagnosticErrorMessage(formatErrorMessage(retryError))) {
          throw new Error(userFacingProviderSessionErrorMessage(formatErrorMessage(retryError)));
        }
        throw retryError;
      }
    }

    if (!isAgentNotFoundError(error)) {
      throw error;
    }

    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(currentWorker)) {
      throw error;
    }

    const resumedWorker = await resumeMissingDirectWorker(run, currentWorker ?? worker);
    if (!resumedWorker) {
      throw error;
    }

    // resumeMissingDirectWorker just wrote the resumed runtime agent's
    // state ("idle" or "starting") into the DB. The askAgent call on the
    // next line drives the runtime to "working", but no other code path
    // touches the workers row until askAgent resolves — which for a long
    // Claude turn is many minutes. Without re-arming the DB row here the
    // frontend sees the worker as idle for the entire turn and never
    // shows the "Thinking…" indicator.
    await db.update(workers).set({
      status: "working",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
    notifyEventStreamSubscribers();

    const replayPrompt = resumedWorker.transcriptReplayRequired
      ? await buildTranscriptReplayPrompt({
        runId: run.id,
        workerId: worker.id,
        nextUserPrompt: workerPrompt,
      })
      : null;
    try {
      return imageAttachments?.length
        ? await askAgent(worker.id, replayPrompt ?? workerPrompt, imageAttachments, { expectedTurnGeneration })
        : await askAgent(worker.id, replayPrompt ?? workerPrompt, undefined, { expectedTurnGeneration });
    } catch (retryError) {
      if (isProviderSessionDiagnosticErrorMessage(formatErrorMessage(retryError))) {
        throw new Error(userFacingProviderSessionErrorMessage(formatErrorMessage(retryError)));
      }
      throw retryError;
    }
  }
}

async function continueWorkerConversation({
  run,
  worker,
  content,
  userInputText,
  userInputId,
  attachments,
  appendUserInputBeforeAsk = false,
  allowCancelledWorkerResume = false,
  promptOverride = null,
  expectedTurnGeneration,
  onUserInputAppended,
}: {
  run: RunRecord;
  worker: WorkerRecord;
  content: string;
  userInputText: string;
  userInputId?: string;
  attachments: ChatAttachment[];
  appendUserInputBeforeAsk?: boolean;
  allowCancelledWorkerResume?: boolean;
  promptOverride?: string | null;
  expectedTurnGeneration: number;
  onUserInputAppended?: () => void;
}) {
  try {
    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(currentWorker) && !allowCancelledWorkerResume) {
      onUserInputAppended?.();
      return;
    }

    const activatedWorker = await db.update(workers).set({
      status: "working",
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, worker.id),
      eq(workers.turnGeneration, expectedTurnGeneration),
    )).returning({ id: workers.id }).get();
    if (!activatedWorker) {
      onUserInputAppended?.();
      return;
    }
    notifyEventStreamSubscribers();

    let userInputAppended = false;
    const appendDeliveredUserInput = async (deliveredAt: Date) => {
      await appendUserInputOnDelivery({
        id: userInputId,
        runId: run.id,
        workerId: worker.id,
        text: userInputText,
        deliveredAt,
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
          storagePath: attachment.storagePath,
        })),
        expectedTurnGeneration,
      });
      userInputAppended = true;
      onUserInputAppended?.();
    };

    if (appendUserInputBeforeAsk) {
      await appendDeliveredUserInput(new Date());
      notifyEventStreamSubscribers();
    }

    const imageAttachments = resolveImageAttachments(attachments, getAppDataPath);
    const response = await askDirectWorkerWithResume(
      run,
      worker,
      content,
      imageAttachments,
      promptOverride,
      expectedTurnGeneration,
    );
    if (!await isWorkerTurnGenerationCurrent(worker.id, expectedTurnGeneration)) {
      onUserInputAppended?.();
      notifyEventStreamSubscribers();
      return;
    }
    if (!userInputAppended) {
      // Append user_input on delivery — `askDirectWorkerWithResume` has
      // resolved successfully, so the prompt definitely reached the
      // worker. Direct fire-and-forget follow-ups opt into pre-ask
      // appending above because the HTTP response returns immediately
      // while the bridge turn is still in flight.
      await appendDeliveredUserInput(new Date());
    }
    const workerAfterResponse = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(workerAfterResponse)) {
      notifyEventStreamSubscribers();
      return;
    }

    const snapshot = await Promise.resolve(getAgent(worker.id)).catch(() => null);
    if (snapshot) {
      await persistWorkerSnapshot(worker.id, snapshot, { expectedTurnGeneration });
    }
    if (!await isWorkerTurnGenerationCurrent(worker.id, expectedTurnGeneration)) {
      notifyEventStreamSubscribers();
      return;
    }
    await appendAskResponseFallbackEntry({
      runId: run.id,
      workerId: worker.id,
      responseText: response.response,
      snapshot,
      expectedTurnGeneration,
    });

    const workerAfterSnapshot = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(workerAfterSnapshot)) {
      notifyEventStreamSubscribers();
      return;
    }

    await db.update(workers).set({
      status: snapshot?.state ?? response.state,
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, worker.id),
      eq(workers.turnGeneration, expectedTurnGeneration),
    ));

    await resolveRecoveryIncidentsAfterHealthyTurn({
      runId: run.id,
      workerId: worker.id,
      summary: `${worker.id} completed a turn normally after recovery was pending.`,
      reason: "worker_turn_succeeded",
    });

    // Worker response now lives in the unified worker stream — the
    // bridge entries written by persistWorkerSnapshot above carry the
    // response text. The legacy role:"worker" messages row is gone.

    if (isPlanningRun(run)) {
      const latestRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
      const latestWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
      if (latestRun) {
        await refreshPlanningArtifactsForRun({
          run: latestRun,
          worker: latestWorker,
          snapshot,
          responseText: response.response,
        });
      }
    } else if (isDirectRunMode(run.mode)) {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        workerStatus: snapshot?.state ?? response.state,
        responseText: response.response,
        renderedOutput: snapshot?.renderedOutput,
        currentText: snapshot?.currentText,
        lastText: snapshot?.lastText,
        outputEntries: snapshot?.outputEntries,
        pendingPermissions: snapshot?.pendingPermissions,
        pendingElicitations: snapshot?.pendingElicitations,
      });
    }

    notifyEventStreamSubscribers();
  } catch (error) {
    // A stop or steer aborted this turn deliberately. Marking the worker
    // `error` and failing the run here would turn every stop into a red banner.
    if (isWorkerTurnSupersededError(error) || isWorkerTurnAbortedError(error)) {
      notifyEventStreamSubscribers();
      return;
    }
    if (!await isWorkerTurnGenerationCurrent(worker.id, expectedTurnGeneration)) {
      notifyEventStreamSubscribers();
      return;
    }
    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(currentWorker)) {
      notifyEventStreamSubscribers();
      return;
    }

    if (isAgentBusyError(error)) {
      const now = new Date();
      await db.update(workers).set({
        status: "working",
        updatedAt: now,
      }).where(eq(workers.id, worker.id));
      await db.update(runs).set({
        status: isPlanningRun(run) ? "working" : "running",
        failedAt: null,
        lastError: null,
        updatedAt: now,
      }).where(eq(runs.id, run.id));
      notifyEventStreamSubscribers();
      throw Object.assign(error instanceof Error ? error : new Error(formatErrorMessage(error)), { status: 409 });
    }

    if (await handleDirectWorkerQuotaError({ run, worker, error })) {
      return;
    }

    const surfacedErrorMessage = await resolveCredentialAuthFailureMessage(
      run,
      worker,
      userFacingProviderSessionErrorMessage(formatErrorMessage(error)),
    );
    await db.update(workers).set({
      status: "error",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    await persistRunFailure(run.id, new Error(surfacedErrorMessage), {
      surface: {
        code: hasVerifiedDeadCredentialMarker(surfacedErrorMessage)
          ? "account.login_required"
          : "conversation.continue.failed",
        workerId: worker.id,
      },
    });
    throw isProviderSessionDiagnosticErrorMessage(formatErrorMessage(error))
      ? new Error(surfacedErrorMessage)
      : error;
  }
}

type SendConversationMessageArgs = {
  runId: string;
  content: string;
  /**
   * Id the sending client already rendered its own bubble under. Adopting it
   * as the row id means the optimistic row and the persisted row are the same
   * row, so the bubble never changes React key between send and delivery.
   * Rejected unless it is a plain UUID, and ignored when absent.
   */
  clientMessageId?: string | null;
  attachments?: ChatAttachment[];
  busyAction?: BusyMessageAction | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  preferredWorkerAccountId?: string | null;
  allowedWorkerTypes?: string[] | string | null;
};

const CLIENT_MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A send writes at most one user row — the elicitation-answer, supervised and
 * direct branches are mutually exclusive — so one id covers all three.
 *
 * Falls back to a fresh uuid rather than failing the send when the client id
 * is unusable: malformed, or already taken. The taken case is a resend after
 * a partial failure (the row landed, a later step threw); minting a new id
 * degrades that to a duplicate row instead of a primary-key 500 that would
 * lose the user's text entirely.
 */
export async function resolveUserMessageId(clientMessageId: string | null | undefined) {
  const candidate = typeof clientMessageId === "string" ? clientMessageId.trim().toLowerCase() : "";
  if (!CLIENT_MESSAGE_ID_PATTERN.test(candidate)) {
    return randomUUID();
  }
  const existing = await db.select({ id: messages.id }).from(messages).where(eq(messages.id, candidate)).get();
  return existing ? randomUUID() : candidate;
}

function parseExplicitWorkerType(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }
  const normalized = normalizeWorkerType(value.replace(/\s+/g, "-"));
  return SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
    ? normalized as SupportedWorkerType
    : null;
}

function parseWorkerSwitchFromText(content: string) {
  const match = content.match(/\b(?:switch|change|set)\s+(?:the\s+)?(?:cli\s+)?(?:worker|workers|agent|agents|worker\s+agent|worker\s+agents)\s+(?:to|as)\s+(codex|claude(?:[-_\s]+code)?|gemini|open[-_\s]*code|opencode)\b/i);
  if (!match?.[1]) {
    return null;
  }
  return parseExplicitWorkerType(match[1]);
}

async function applyWorkerPreferenceForMessage(args: {
  run: RunRecord;
  content: string;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  preferredWorkerAccountId?: string | null;
  allowedWorkerTypes?: string[] | string | null;
}) {
  const explicitWorkerType = parseExplicitWorkerType(args.preferredWorkerType);
  const textWorkerType = parseWorkerSwitchFromText(args.content);
  const nextWorkerType = explicitWorkerType ?? textWorkerType;
  if (!nextWorkerType) {
    return args.run;
  }

  const nextAllowedWorkerTypes = [nextWorkerType];
  const nextPreferredWorkerModel = explicitWorkerType
    ? args.preferredWorkerModel?.trim() || null
    : null;
  const nextPreferredWorkerEffort = args.preferredWorkerEffort?.trim() || args.run.preferredWorkerEffort || null;
  const nextPreferredWorkerAccountId = args.preferredWorkerAccountId?.trim() || null;
  const now = new Date();

  const existingWorkerTypes = await db.select({ type: workers.type }).from(workers).where(eq(workers.runId, args.run.id));
  assertDirectRunWorkerTypeInvariant({
    run: args.run,
    existingWorkerTypes: existingWorkerTypes.map((worker) => worker.type),
    requestedWorkerType: nextWorkerType,
  });

  await db.update(runs).set({
    preferredWorkerType: nextWorkerType,
    preferredWorkerModel: nextPreferredWorkerModel,
    preferredWorkerEffort: nextPreferredWorkerEffort,
    preferredWorkerAccountId: nextPreferredWorkerAccountId,
    allowedWorkerTypes: JSON.stringify(nextAllowedWorkerTypes),
    updatedAt: now,
  }).where(eq(runs.id, args.run.id));
  await recordExecutionEvent({
    runId: args.run.id,
    workerId: null,
    planItemId: null,
    eventType: "worker_selection_changed",
    details: {
      summary: `Changed preferred worker selection to ${nextWorkerType}.`,
      preferredWorkerType: nextWorkerType,
      preferredWorkerModel: nextPreferredWorkerModel,
      preferredWorkerEffort: nextPreferredWorkerEffort,
      preferredWorkerAccountId: nextPreferredWorkerAccountId,
      allowedWorkerTypes: nextAllowedWorkerTypes,
      source: explicitWorkerType ? "composer_selection" : "message_text",
    },
    createdAt: now,
  });

  return {
    ...args.run,
    preferredWorkerType: nextWorkerType,
    preferredWorkerModel: nextPreferredWorkerModel,
    preferredWorkerEffort: nextPreferredWorkerEffort,
    preferredWorkerAccountId: nextPreferredWorkerAccountId,
    allowedWorkerTypes: JSON.stringify(nextAllowedWorkerTypes),
    updatedAt: now,
  };
}

async function activateRunAndPersistMessage<T>(args: {
  run: RunRecord;
  nextStatus: string;
  activatedAt: Date;
  workerFence?: { workerId: string; expectedTurnGeneration: number; allowCancelled: boolean };
  persist: () => Promise<T>;
}) {
  return runQuotaRecoveryMutation(args.run.id, async () => {
    if (args.workerFence) {
      const currentWorker = await db.select().from(workers).where(eq(workers.id, args.workerFence.workerId)).get();
      const workerOwnershipLost = !currentWorker
        || currentWorker.turnGeneration !== args.workerFence.expectedTurnGeneration
        || (isWorkerCancelled(currentWorker) && !args.workerFence.allowCancelled);
      if (workerOwnershipLost) {
        const reason = "Worker ownership changed before the message could be delivered.";
        emitNamedEvent({
          kind: "session.input.refused",
          runId: args.run.id,
          sessionType: args.run.sessionType,
          code: "worker_changed_before_delivery",
          reason,
        });
        emitNamedEvent({
          kind: "error.surfaced",
          code: "conversation.delivery_refused",
          message: reason,
          surface: "toast",
          runId: args.run.id,
          workerId: args.workerFence.workerId,
          conversationId: args.run.id,
        });
        throw Object.assign(new Error(reason), { status: 409 });
      }
    }

    // The status observed when this send began is its ownership token. Stop
    // writes `cancelled` under this same fence. A send that began before Stop
    // therefore loses this CAS, while a deliberate new send that begins after
    // Stop observes `cancelled` and may explicitly resume the conversation.
    const activatedRun = await db.update(runs).set({
      status: args.nextStatus,
      failedAt: null,
      lastError: null,
      updatedAt: args.activatedAt,
    }).where(and(
      eq(runs.id, args.run.id),
      eq(runs.status, args.run.status),
    )).returning().get();

    if (!activatedRun) {
      const currentRun = await db.select().from(runs).where(eq(runs.id, args.run.id)).get();
      const reason = currentRun
        ? `Conversation changed from ${args.run.status} to ${currentRun.status} before the message could be delivered.`
        : "Conversation was removed before the message could be delivered.";
      emitNamedEvent({
        kind: "session.input.refused",
        runId: args.run.id,
        sessionType: args.run.sessionType,
        code: "run_changed_before_delivery",
        reason,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "conversation.delivery_refused",
        message: reason,
        surface: "toast",
        runId: args.run.id,
        conversationId: args.run.id,
      });
      throw Object.assign(new Error(reason), { status: 409 });
    }

    const persisted = await args.persist();
    return { run: activatedRun, persisted };
  });
}

async function stopConversationFromManualStopCommand(run: RunRecord) {
  if (!isStoppableRunStatus(run.status)) {
    return {
      ok: true as const,
      stopped: false as const,
      ignored: true as const,
      runId: run.id,
      workerId: null,
      runCancelled: false,
      reason: "not_stoppable" as const,
    };
  }

  if (isSupervisedRun(run)) {
    cancelSupervisorWake(run.id);
    stopRunObserver(run.id);
    await clearSupervisorWakeLease(run.id);
    const runWorkers = await db.select().from(workers).where(eq(workers.runId, run.id));
    const activeWorkers = runWorkers.filter((worker) => isStoppableWorkerStatus(worker.status));
    for (const worker of activeWorkers) {
      void cancelAgent(worker.id).catch(() => undefined);
      await db.update(workers).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      emitNamedEvent({
        kind: "worker.status",
        runId: run.id,
        workerId: worker.id,
        prev: worker.status,
        next: "cancelled",
      });
      emitNamedEvent({
        kind: "worker.terminal",
        runId: run.id,
        workerId: worker.id,
        status: "cancelled",
      });
    }

    const now = new Date();
    await db.update(runs).set({
      status: "cancelled",
      updatedAt: now,
    }).where(eq(runs.id, run.id));
    await recordExecutionEvent({
      runId: run.id,
      workerId: null,
      planItemId: null,
      eventType: "supervisor_stopped",
      details: {
        summary: "Stopped supervisor from exact stop command.",
        reason: "User sent an exact stop command.",
        userInitiated: true,
        cancelledWorkerIds: activeWorkers.map((worker) => worker.id),
        source: "manual_stop_message",
      },
      createdAt: now,
    });
    notifyEventStreamSubscribers();
    return {
      ok: true as const,
      stopped: true as const,
      runId: run.id,
      workerId: null,
      runCancelled: true,
    };
  }

  const worker = await selectConversationWorker(run.id);
  if (!worker || !isStoppableWorkerStatus(worker.status)) {
    return {
      ok: true as const,
      stopped: false as const,
      ignored: true as const,
      runId: run.id,
      workerId: worker?.id ?? null,
      runCancelled: false,
      reason: "not_stoppable" as const,
    };
  }

  void cancelAgent(worker.id).catch(() => undefined);
  const now = new Date();
  await db.update(workers).set({
    status: "cancelled",
    updatedAt: now,
  }).where(eq(workers.id, worker.id));
  emitNamedEvent({
    kind: "worker.status",
    runId: run.id,
    workerId: worker.id,
    prev: worker.status,
    next: "cancelled",
  });
  emitNamedEvent({
    kind: "worker.terminal",
    runId: run.id,
    workerId: worker.id,
    status: "cancelled",
  });

  const remainingWorkers = await db.select().from(workers).where(eq(workers.runId, run.id));
  const hasActiveWorker = remainingWorkers.some((candidate) => isStoppableWorkerStatus(candidate.status));
  if (!hasActiveWorker) {
    await db.update(runs).set({
      status: "cancelled",
      updatedAt: now,
    }).where(eq(runs.id, run.id));
  }

  await recordExecutionEvent({
    runId: run.id,
    workerId: worker.id,
    planItemId: null,
    eventType: "worker_cancelled",
    details: {
      summary: `Stopped ${worker.id}`,
      reason: "User sent an exact stop command.",
      runCancelled: !hasActiveWorker,
      source: "manual_stop_message",
    },
    createdAt: now,
  });
  notifyEventStreamSubscribers();
  return {
    ok: true as const,
    stopped: true as const,
    runId: run.id,
    workerId: worker.id,
    runCancelled: !hasActiveWorker,
  };
}

/**
 * Attempts delivery of whatever is pending for `workerId` right after a row was
 * enqueued, instead of waiting for a sync pass to observe a status transition.
 * A message queued in the same beat that the worker went idle has no transition
 * left to wait for, so the row would otherwise sit `pending` indefinitely.
 *
 * Imported lazily: `sync` pulls in the recovery and planning graphs, and this
 * module sits underneath both of them.
 */
async function flushQueuedWorkerMessagesAfterEnqueue(runId: string, workerId: string) {
  try {
    const worker = await db.select({ status: workers.status }).from(workers).where(eq(workers.id, workerId)).get();
    if (!worker) {
      return;
    }
    const { drainQueuedWorkerMessagesWithObservation } = await import("./sync");
    await drainQueuedWorkerMessagesWithObservation({
      runId,
      workerId,
      workerStatus: worker.status,
      source: "post_enqueue_flush",
    });
  } catch (error) {
    console.error(`Post-enqueue queue flush failed for ${workerId}:`, error);
  }
}

export async function sendConversationMessage(args: SendConversationMessageArgs) {
  // A steer is cancel-and-replace; it must not wait out a retry/edit that
  // holds the conversation mutex for its whole replayed turn. Preempting the
  // recovery epoch aborts that holder's turn before we queue on the mutex.
  if (args.busyAction === "steer") {
    return preemptRecoveryForInterrupt(args.runId, () => sendConversationMessageUnlocked(args));
  }
  return runConversationMutation(args.runId, () => sendConversationMessageUnlocked(args));
}

async function sendConversationMessageUnlocked({
  runId,
  content,
  clientMessageId = null,
  attachments = [],
  busyAction = null,
  preferredWorkerType = null,
  preferredWorkerModel = null,
  preferredWorkerEffort = null,
  preferredWorkerAccountId = null,
  allowedWorkerTypes = null,
}: SendConversationMessageArgs) {
  const trimmedContent = content.trim();
  const userMessageId = await resolveUserMessageId(clientMessageId);
  const normalizedAttachments = normalizeChatAttachments(attachments);
  const attachmentsJson = serializeChatAttachments(normalizedAttachments);
  const workerContent = appendAttachmentContext(trimmedContent, normalizedAttachments, {
    resolvePath: (storagePath) => getAppDataPath(storagePath),
    imagesInlined: true,
  });
  if (!trimmedContent && normalizedAttachments.length === 0) {
    throw Object.assign(new Error("Message content or attachment is required"), { status: 400 });
  }

  let run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }
  await assertRunNotHandoffFenced(runId);
  if (normalizedAttachments.length === 0 && isManualStopCommand(trimmedContent)) {
    const stopped = await stopConversationFromManualStopCommand(run);
    return stopped;
  }
  run = await applyWorkerPreferenceForMessage({
    run,
    content: trimmedContent,
    preferredWorkerType,
    preferredWorkerModel,
    preferredWorkerEffort,
    preferredWorkerAccountId,
    allowedWorkerTypes,
  });

  if (isPlanningRun(run) && (run.status === "reviewing_plan" || run.status === "revising_plan")) {
    throw Object.assign(new Error("Plan review is in progress. Please wait for the review to complete before sending further messages."), { status: 409 });
  }

  if (isSupervisedRun(run) && (busyAction === "queue" || busyAction === "steer")) {
    if (busyAction === "steer") {
      const worker = await selectConversationWorker(runId);
      if (!worker) {
        throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
      }
      return interruptWithDraftMessage({
        runId,
        content: trimmedContent,
        attachments: normalizedAttachments,
        targetWorkerId: worker.id,
        source: "api",
      });
    }

    const queuedMessage = await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: trimmedContent,
      attachments: normalizedAttachments,
      clientMessageId,
    });
    startSupervisorRun(runId);
    return { ok: true, queuedMessage };
  }

  if (busyAction === "queue") {
    const worker = await selectConversationWorker(runId);
    if (!worker) {
      throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
    }
    if (isDirectRunMode(run.mode) || isPlanningRun(run)) {
      await reconcileWorkerUserMessagesInStream(runId, worker.id);
    }

    const queuedMessage = await createQueuedConversationMessage({
      runId,
      targetWorkerId: worker.id,
      action: "queue",
      content: trimmedContent,
      attachments: normalizedAttachments,
      clientMessageId,
    });
    // `busyAction` is the client's intent for *if* the worker is busy, and the
    // client decides that from a snapshot that may already be stale by the time
    // the row lands. Try to flush regardless of what it guessed, rather than
    // waiting for a sync pass to notice: the drain no-ops while the worker is
    // genuinely mid-turn, and claiming is atomic on `status = 'pending'`, so an
    // already-running delivery cannot double-send. Detached from this mutation
    // so the drain queues behind it for the mutex instead of reentering it.
    runDetachedFromConversationMutation(() => {
      void flushQueuedWorkerMessagesAfterEnqueue(runId, worker.id);
    });
    return { ok: true, queuedMessage };
  }

  if (isSupervisedRun(run)) {
    const pendingClarification = await db
      .select()
      .from(clarifications)
      .where(and(eq(clarifications.runId, runId), eq(clarifications.status, "pending")))
      .orderBy(asc(clarifications.createdAt), asc(clarifications.id))
      .get();
    const createdAt = new Date();
    const message = {
      id: userMessageId,
      runId,
      role: "user",
      kind: pendingClarification ? "clarification_answer" : "checkpoint",
      content: trimmedContent,
      attachmentsJson,
      createdAt,
    };

    const activation = await activateRunAndPersistMessage({
      run,
      nextStatus: "running",
      activatedAt: createdAt,
      persist: () => db.insert(messages).values(message),
    });
    run = activation.run;

    if (pendingClarification) {
      await answerClarification(pendingClarification.id, trimmedContent);
      const resumeResult = await resumeRunAfterClarification(runId);
      notifyEventStreamSubscribers();
      return {
        ok: true,
        message: serializeMessageRecord({ ...message, attachmentsJson }),
        ...resumeResult,
      };
    }

    startSupervisorRun(runId);
    notifyEventStreamSubscribers();
    return {
      ok: true,
      message: serializeMessageRecord({ ...message, attachmentsJson }),
    };
  }

  let worker = await selectConversationWorker(runId);
  if (!worker) {
    throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
  }
  // This is user intent captured before Stop can change the worker. A worker
  // already cancelled when the request began may be resumed; one cancelled by
  // a later Stop may not.
  const allowCancelledWorkerResume = isWorkerCancelled(worker);
  if (isDirectRunMode(run.mode) || isPlanningRun(run)) {
    await reconcileWorkerUserMessagesInStream(runId, worker.id);
  }

  if (isDirectRunMode(run.mode) && run.status === "awaiting_user") {
    const elicitationAnswer = await answerDirectWorkerElicitation({
      run,
      worker,
      userText: trimmedContent,
      workerText: workerContent,
      attachments: normalizedAttachments,
      attachmentsJson,
      messageId: userMessageId,
    });
    if (elicitationAnswer) {
      await retireMatchingQueuedDirectAnswers({
        runId,
        workerId: worker.id,
        content: trimmedContent,
        attachmentsJson,
        answeredAt: elicitationAnswer.createdAt,
      });
      notifyEventStreamSubscribers();
      return {
        ok: true,
        message: serializeMessageRecord({ ...elicitationAnswer, attachmentsJson }),
      };
    }
  }

  // `worker.status` is a persisted snapshot and lags the turn gate, so a steer
  // aimed at a worker that is genuinely mid-turn could miss this branch and
  // instead queue behind the gate below, holding the request open for the whole
  // turn. Interrupting is what the caller asked for, so ask the gate directly.
  const isWorkerMidTurn = ["starting", "working", "stuck"].includes(worker.status.trim().toLowerCase().split(":")[0] ?? "")
    || hasLiveWorkerTurn(worker.id);
  if (busyAction === "steer" && isWorkerMidTurn) {
    return interruptWithDraftMessage({
      runId,
      content: trimmedContent,
      attachments: normalizedAttachments,
      targetWorkerId: worker.id,
      source: "api",
    });
  }

  const userMessageCreatedAt = new Date();
  const userMessage = {
    id: userMessageId,
    runId,
    role: "user",
    kind: "checkpoint",
    content: trimmedContent,
    attachmentsJson,
    createdAt: userMessageCreatedAt,
  };

  const activation = await activateRunAndPersistMessage({
    run,
    nextStatus: isPlanningRun(run) ? "working" : "running",
    activatedAt: userMessageCreatedAt,
    persist: async () => {
      // Stream-first: append the user_input entry BEFORE the DB insert so that
      // a crash between the two writes leaves at most a harmless orphan stream
      // entry rather than a DB row the worker can never see. The stream entry
      // is keyed by message id so retries remain idempotent.
      if (isDirectRunMode(run.mode)) {
        await appendUserInputOnDelivery({
          id: userMessage.id,
          runId: run.id,
          workerId: worker.id,
          text: trimmedContent,
          deliveredAt: userMessageCreatedAt,
          attachments: normalizedAttachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
            storagePath: attachment.storagePath,
          })),
        });
      }
      await db.insert(messages).values(userMessage);
    },
  });
  run = activation.run;
  notifyEventStreamSubscribers();

  if (isDirectRunMode(run.mode)) {
    const selectedWorker = await reconcileDirectWorkerSelection({
      run,
      worker,
      nextUserPrompt: buildDirectWorkerPrompt(workerContent),
    });
    const promptOverride = selectedWorker?.replayPrompt ?? null;
    if (selectedWorker) {
      worker = selectedWorker.worker;
    }
    notifyEventStreamSubscribers();
    const expectedTurnGeneration = worker.turnGeneration;

    if (busyAction === "steer") {
      // Steer runs in the background for the same reason a plain follow-up
      // does: awaiting it held the HTTP response open for the whole turn, which
      // read to the client as a send that never completed. The message is
      // already persisted and streamed, so the caller has everything it needs.
      // A worker that reports busy anyway falls back to a queued row, which
      // reaches the client over the event stream.
      const steerTurn = trackConversationBackgroundTask(runWorkerTurn(worker.id, () => continueWorkerConversation({
        run,
        worker,
        content: workerContent,
        userInputText: trimmedContent,
        userInputId: userMessage.id,
        attachments: normalizedAttachments,
        // Already appended above.
        appendUserInputBeforeAsk: false,
        allowCancelledWorkerResume,
        promptOverride,
        expectedTurnGeneration,
      })), { runId });
      steerTurn.catch(async (error) => {
        if (!isAgentBusyError(error)) {
          console.error("Direct conversation steer failed:", error);
          return;
        }
        await db.delete(messages).where(eq(messages.id, userMessage.id));
        await createQueuedConversationMessage({
          runId,
          targetWorkerId: worker.id,
          action: "steer",
          content: trimmedContent,
          attachments: normalizedAttachments,
        });
        notifyEventStreamSubscribers();
      });

      return {
        ok: true,
        message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
      };
    }

    // Direct follow-up follows the same "append-immediately" path. The
    // turn runs in the background.
    const turn = trackConversationBackgroundTask(runWorkerTurn(worker.id, () => continueWorkerConversation({
      run,
      worker,
      content: workerContent,
      userInputText: trimmedContent,
      userInputId: userMessage.id,
      attachments: normalizedAttachments,
      // Already appended above.
      appendUserInputBeforeAsk: false,
      allowCancelledWorkerResume,
      promptOverride,
      expectedTurnGeneration,
    })), { runId });
    turn.catch((error) => {
      if (isAgentBusyError(error)) {
        return;
      }

      console.error("Direct conversation follow-up failed:", error);
    });

    return {
      ok: true,
      message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
    };
  }

  try {
    await runWorkerTurn(worker.id, () => continueWorkerConversation({
      run,
      worker,
      content: workerContent,
      userInputText: trimmedContent,
      userInputId: userMessage.id,
      attachments: normalizedAttachments,
      expectedTurnGeneration: worker.turnGeneration,
    }));
  } catch (error) {
    if (busyAction === "steer" && isAgentBusyError(error)) {
      await db.delete(messages).where(eq(messages.id, userMessage.id));
      const queuedMessage = await createQueuedConversationMessage({
        runId,
        targetWorkerId: worker.id,
        action: "steer",
        content: trimmedContent,
        attachments: normalizedAttachments,
      });
      return {
        ok: true,
        message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
        queuedMessage,
      };
    }

    throw error;
  }

  return {
    ok: true,
    message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
  };
}
