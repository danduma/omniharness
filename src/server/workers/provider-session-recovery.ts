import { cancelAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { runs, workerCredentialAllocations, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { appendWorkerSessionMetadata } from "@/server/workers/session-metadata";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { resolveWorkerLaunchSelection } from "@/server/workers/launch-selection";
import { buildTranscriptReplayPrompt } from "./session-recovery";
import { eq } from "drizzle-orm";

export type WorkerRecreationSelection = {
  type: string;
  model: string | null;
  effort: string | null;
  accountId: string | null;
  credentialSource: "gateway" | "account";
};

export async function recreateWorkerFromTranscript(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  nextUserPrompt: string;
  source: "steer" | "direct-follow-up" | "direct-retry";
  reason: string;
  selection?: WorkerRecreationSelection;
}) {
  const oldSessionId = args.worker.bridgeSessionId?.trim() || null;
  try {
    await cancelAgent(args.worker.id);
  } catch (error) {
    await recordExecutionEvent({
      runId: args.run.id,
      workerId: args.worker.id,
      eventType: "worker_session_recreation_cancel_failed",
      details: {
        summary: `Could not stop the poisoned runtime for ${args.worker.id} before creating a fresh session.`,
        source: args.source,
        reason: error instanceof Error ? error.message : String(error),
        oldSessionId,
      },
    });
  }

  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(args.worker.bridgeSessionMode, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();
  const launchSelection = args.selection ?? resolveWorkerLaunchSelection(args.worker, args.run);
  const spawnParams = {
    type: args.selection?.type ?? args.worker.type,
    cwd: args.worker.cwd,
    name: args.worker.id,
    ...(workerMode ? { mode: workerMode } : {}),
    env: envParams,
    ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
    ...(launchSelection.model ? { model: launchSelection.model } : {}),
    ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
  };

  await db.update(workers).set({
    status: "starting",
    bridgeSessionId: null,
    bridgeSessionMode: null,
    currentText: "",
    updatedAt: new Date(),
  }).where(eq(workers.id, args.worker.id));

  let freshWorker: AgentRecord;
  try {
    freshWorker = await spawnAgent(spawnParams) as AgentRecord;
  } catch (error) {
    await recordExecutionEvent({
      runId: args.run.id,
      workerId: args.worker.id,
      eventType: "worker_session_recreation_failed",
      details: {
        summary: `Could not create a fresh runtime session for ${args.worker.id}.`,
        source: args.source,
        reason: error instanceof Error ? error.message : String(error),
        oldSessionId,
      },
    });
    throw error;
  }

  const now = new Date();
  await db.update(workers).set({
    type: freshWorker.type || args.selection?.type || args.worker.type,
    status: freshWorker.state,
    cwd: freshWorker.cwd || args.worker.cwd,
    bridgeSessionId: freshWorker.sessionId ?? null,
    bridgeSessionMode: freshWorker.sessionMode ?? workerMode ?? null,
    currentText: freshWorker.currentText,
    lastText: freshWorker.lastText,
    ...(args.selection ? {
      effectiveLaunchModel: launchSelection.model,
      effectiveLaunchEffort: launchSelection.effort,
      launchCredentialSource: launchSelection.credentialSource,
    } : {}),
    updatedAt: now,
  }).where(eq(workers.id, args.worker.id));

  if (args.selection?.accountId) {
    const existingAllocation = await db
      .select()
      .from(workerCredentialAllocations)
      .where(eq(workerCredentialAllocations.workerId, args.worker.id))
      .get();
    if (existingAllocation) {
      await db.update(workerCredentialAllocations).set({
        workerType: args.selection.type,
        accountId: args.selection.accountId,
        strategy: "manual",
        selectionReason: "explicit continuation worker selection",
        explicit: true,
        updatedAt: now,
      }).where(eq(workerCredentialAllocations.id, existingAllocation.id));
    }
  }
  await appendWorkerSessionMetadata({
    runId: args.run.id,
    workerId: args.worker.id,
    sessionId: freshWorker.sessionId ?? null,
    sessionMode: freshWorker.sessionMode ?? workerMode ?? null,
    source: args.source,
  });
  await persistWorkerSnapshot(args.worker.id, freshWorker);

  const replayPrompt = await buildTranscriptReplayPrompt({
    runId: args.run.id,
    workerId: args.worker.id,
    nextUserPrompt: args.nextUserPrompt,
  });
  await recordExecutionEvent({
    runId: args.run.id,
    workerId: args.worker.id,
    eventType: "worker_session_recreated_from_transcript",
    details: {
      summary: `Started a fresh runtime worker for ${args.worker.id} and continued from the saved OmniHarness transcript.`,
      source: args.source,
      reason: args.reason,
      rejectedSessionId: oldSessionId,
      sessionId: freshWorker.sessionId ?? null,
      transcriptReplay: true,
    },
    createdAt: now,
  });
  emitNamedEvent({
    kind: "worker.recreated",
    runId: args.run.id,
    workerId: args.worker.id,
  });

  return { worker: freshWorker, replayPrompt };
}
