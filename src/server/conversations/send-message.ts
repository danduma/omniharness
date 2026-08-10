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
import { interruptWithDraftMessage } from "./queued-message-interrupt";
import { serializeMessageRecord } from "./message-records";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { isWorkerTurnAbortedError, isWorkerTurnSupersededError, runConversationMutation, runWorkerTurn, trackConversationBackgroundTask } from "./worker-turn-gate";
import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
import { isManualStopCommand } from "@/interface/home/busy-message-behavior";
import { emitNamedEvent } from "@/server/events/named-events";
import { cancelSupervisorWake } from "@/server/supervisor/wake";
import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
import { stopRunObserver } from "@/server/supervisor/observer";
import { buildDirectWorkerPrompt } from "./direct-worker-prompt";
import { extractQuotaResetInfo } from "@/server/quota/reset-parser";
import { handleWorkerQuotaExhaustion } from "@/server/quota/recovery";
import { reconcileRecoveredHumanInputEntries } from "@/server/workers/human-input-entries";
import { resolveRecoveryIncidentsAfterHealthyTurn } from "@/server/runs/recovery-incidents";
import {
  isProviderSessionDiagnosticErrorMessage,
  userFacingProviderSessionErrorMessage,
} from "@/server/workers/session-recovery";
import { recreateWorkerFromTranscript, type WorkerRecreationSelection } from "@/server/workers/provider-session-recovery";
import { decodeClaudeGatewayModel } from "@/lib/claude-model-gateway";
import { annotateVerifiedLiveCredential, isAuthShapedProviderFailure } from "@/lib/provider-account-failures";
import { supportsCredentialLivenessProbe, verifyAccountCredentialLiveness } from "@/server/accounts/credential-verification";

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
  }).where(eq(workers.id, args.worker.id));
  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: createdAt,
  }).where(eq(runs.id, args.run.id));
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
      });
    } catch (error) {
      process.stderr.write(
        `[send-message] failed to backfill user_input for message ${message.id} on worker ${workerId}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
}

export async function resumeMissingDirectWorker(run: RunRecord, worker: WorkerRecord) {
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
      }).where(eq(workers.id, worker.id));
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
      await db.update(workers).set({
        status: "starting",
        bridgeSessionId: null,
        bridgeSessionMode: null,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
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
        await db.update(workers).set({
          status: "starting",
          bridgeSessionId: null,
          bridgeSessionMode: null,
          updatedAt: new Date(),
        }).where(eq(workers.id, worker.id));
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

  await db.update(workers).set({
    status: resumedWorker.state,
    bridgeSessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
    bridgeSessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    updatedAt: new Date(),
  }).where(eq(workers.id, worker.id));
  await appendWorkerSessionMetadata({
    runId: run.id,
    workerId: worker.id,
    sessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
    sessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    source: "direct-follow-up",
  });

  await persistWorkerSnapshot(worker.id, resumedWorker);
  notifyEventStreamSubscribers();
  return { ...resumedWorker, transcriptReplayRequired };
}

// A provider that blames the credential is usually just having a bad second.
// Retry the turn a couple of times before anyone concludes the account is dead.
const AUTH_RETRY_BACKOFF_MS = [2_000, 6_000];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function resolveWorkerAccountId(run: RunRecord, worker: WorkerRecord) {
  const allocation = await db
    .select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, worker.id))
    .get();
  return allocation?.accountId ?? run.preferredWorkerAccountId?.trim() ?? null;
}

/**
 * Decide whether an auth-shaped failure is really the account's fault.
 *
 * Returns the message to persist: annotated as verified-live when the
 * credential provably still works (so recovery stays armed), or untouched when
 * the credential is dead or the probe was inconclusive (so the run latches and
 * the user is told to re-authenticate).
 */
async function resolveAuthFailureMessage(run: RunRecord, worker: WorkerRecord, message: string) {
  if (!isAuthShapedProviderFailure(message) || !supportsCredentialLivenessProbe(worker.type)) {
    return message;
  }

  const accountId = await resolveWorkerAccountId(run, worker);
  const verification = await verifyAccountCredentialLiveness({
    workerType: worker.type,
    accountId,
    cwd: worker.cwd || run.projectPath || process.cwd(),
  });

  await recordExecutionEvent({
    runId: run.id,
    workerId: worker.id,
    eventType: "worker_credential_verified",
    details: {
      summary: verification.liveness === "live"
        ? "Provider reported an auth failure but the credential still works; treating it as transient."
        : `Credential verification returned "${verification.liveness}"; the failure stands.`,
      accountId,
      liveness: verification.liveness,
      detail: verification.detail,
      providerError: message,
    },
  });

  return verification.liveness === "live" ? annotateVerifiedLiveCredential(message) : message;
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
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await (imageAttachments?.length
        ? askAgent(workerId, prompt, imageAttachments)
        : askAgent(workerId, prompt));
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
) {
  const workerPrompt = promptOverride ?? (isDirectRunMode(run.mode) ? buildDirectWorkerPrompt(content) : content);
  try {
    return await askAgentWithAuthRetry(worker.id, workerPrompt, imageAttachments);
  } catch (error) {
    if (isProviderSessionDiagnosticErrorMessage(formatErrorMessage(error))) {
      const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
      const recreated = await recreateWorkerFromTranscript({
        run,
        worker: currentWorker ?? worker,
        nextUserPrompt: workerPrompt,
        source: "direct-follow-up",
        reason: "provider_session_diagnostic_after_direct_follow_up",
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
          ? await askAgent(worker.id, recreated.replayPrompt, imageAttachments)
          : await askAgent(worker.id, recreated.replayPrompt);
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
        ? await askAgent(worker.id, replayPrompt ?? workerPrompt, imageAttachments)
        : await askAgent(worker.id, replayPrompt ?? workerPrompt);
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
  onUserInputAppended?: () => void;
}) {
  try {
    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(currentWorker) && !allowCancelledWorkerResume) {
      onUserInputAppended?.();
      return;
    }

    await db.update(workers).set({
      status: "working",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
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
        })),
      });
      userInputAppended = true;
      onUserInputAppended?.();
    };

    if (appendUserInputBeforeAsk) {
      await appendDeliveredUserInput(new Date());
      notifyEventStreamSubscribers();
    }

    const imageAttachments = resolveImageAttachments(attachments, getAppDataPath);
    const response = await askDirectWorkerWithResume(run, worker, content, imageAttachments, promptOverride);
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
      await persistWorkerSnapshot(worker.id, snapshot);
    }
    await appendAskResponseFallbackEntry({
      runId: run.id,
      workerId: worker.id,
      responseText: response.response,
      snapshot,
    });

    const workerAfterSnapshot = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(workerAfterSnapshot)) {
      notifyEventStreamSubscribers();
      return;
    }

    await db.update(workers).set({
      status: snapshot?.state ?? response.state,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));

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

    const surfacedErrorMessage = await resolveAuthFailureMessage(
      run,
      worker,
      userFacingProviderSessionErrorMessage(formatErrorMessage(error)),
    );
    await db.update(workers).set({
      status: "error",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    await persistRunFailure(run.id, new Error(surfacedErrorMessage), {
      surface: { code: "conversation.continue.failed", workerId: worker.id },
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

export async function sendConversationMessage(args: SendConversationMessageArgs) {
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

    await db.insert(messages).values(message);

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

    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));
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

  if (busyAction === "steer" && ["starting", "working", "stuck"].includes(worker.status.trim().toLowerCase().split(":")[0] ?? "")) {
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

  // Stream-first: append the user_input entry BEFORE the DB insert so that
  // a crash between the two writes leaves at most a harmless orphan stream
  // entry rather than a DB row the worker can never see. The stream entry
  // is keyed by message id so the write is idempotent — if a retry lands on
  // a row that already exists in the stream, appendUserInputOnDelivery
  // dedups instead of double-appending.
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
      })),
    });
  }

  await db.insert(messages).values(userMessage);
  await db.update(runs).set({
    status: isPlanningRun(run) ? "working" : "running",
    failedAt: null,
    lastError: null,
    updatedAt: userMessageCreatedAt,
  }).where(eq(runs.id, runId));
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
    const allowCancelledWorkerResume = isWorkerCancelled(worker);

    if (busyAction === "steer") {
      try {
        await runWorkerTurn(worker.id, () => continueWorkerConversation({
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
        }));
      } catch (error) {
        if (isAgentBusyError(error)) {
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
