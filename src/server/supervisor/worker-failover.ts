import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { and, desc, eq } from "drizzle-orm";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { recoveryIncidents, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { buildSyntheticHandoff, requestWorkerHandoff } from "@/server/handoff/request";
import { renderHandoffSeed } from "@/server/handoff/render";
import type { HandoffReport } from "@/server/handoff/parser";
import { markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
import {
  parkRunForQuotaWait,
  recordWorkerQuotaBlock,
  refuseLateQuotaRecovery,
  transitionRunForQuotaRecovery,
  type WorkerQuotaBlockResult,
} from "@/server/quota/recovery";
import { extractQuotaResetInfo } from "@/server/quota/reset-parser";
import { getRecoveryPolicy } from "@/server/runs/recovery-policy";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { appendSupervisorInputOnDelivery } from "@/server/workers/stream-writer";
import { selectSpawnableWorkerTypeAsync } from "@/server/supervisor/worker-availability";
import {
  normalizeWorkerType,
  parseAllowedWorkerTypes,
  type SupportedWorkerType,
} from "@/server/supervisor/worker-types";
import { runs } from "@/server/db/schema";
import { allocateWorkerAccount } from "@/server/accounts/account-allocator";
import { resolveWorkerLaunchSelection } from "@/server/workers/launch-selection";
import { prepareClaudeGatewayLaunch } from "@/server/integrations/claude-model-gateway/worker-env";
import {
  abortWorkerTurn,
  advanceWorkerTurnGeneration,
  readWorkerTurnGeneration,
  runWorkerTurn,
} from "@/server/conversations/worker-turn-gate";
import { runQuotaRecoveryMutation } from "@/server/quota/recovery-mutation";
import { isTerminalRunStatus, normalizeRunStatus } from "@/server/runs/status";

export type FailoverEnv = Record<string, string | undefined>;

function compactEnv(env: FailoverEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export type AttemptWorkerFailoverArgs = {
  runId: string;
  outgoingWorkerId: string;
  outgoingWorkerType: SupportedWorkerType;
  quotaText: string;
  originalPrompt: string;
  allowedTypes: SupportedWorkerType[];
  env: FailoverEnv;
  cwd: string;
  title: string;
  /** Pre-recorded block (e.g., from the observer path) to avoid double-recording. */
  existingBlock?: WorkerQuotaBlockResult;
  /** Optional override for the per-run retry cap. Defaults to allowedTypes.length. */
  maxAttempts?: number;
  /** Optional override for the handoff request timeout. Defaults to policy.maxHandoffWaitMs. */
  handoffTimeoutMs?: number;
  now?: Date;
};

export type AttemptWorkerFailoverResult =
  | {
      state: "failed_over";
      newWorkerId: string;
      newType: SupportedWorkerType;
      handoff: HandoffReport;
    }
  | { state: "no_replacement"; reason: string }
  | { state: "park_failed"; reason: string }
  | { state: "ignored"; reason: "run_missing" | "run_terminal" | "worker_cancelled" };

function truncate(value: string, maxLength = 2_000) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function appendWorkerOutput(existingLog: string | null | undefined, nextChunk: string) {
  if (!nextChunk.trim()) {
    return existingLog ?? "";
  }
  return [existingLog ?? "", nextChunk].filter((part) => part.trim()).join("\n\n");
}

async function setIncidentFailoverFlag(incidentId: string, value: boolean | "resolved") {
  const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incidentId)).get();
  if (!incident) return;
  let details: Record<string, unknown> = {};
  try {
    const parsed: unknown = incident.details ? JSON.parse(incident.details) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      details = parsed as Record<string, unknown>;
    }
  } catch {
    details = {};
  }
  if (value === "resolved") {
    details.failover_pending = false;
    details.failover_resolved_at = new Date().toISOString();
  } else {
    details.failover_pending = value;
  }
  await db.update(recoveryIncidents).set({
    details: JSON.stringify(details),
    updatedAt: new Date(),
  }).where(eq(recoveryIncidents.id, incidentId));
}

async function findOpenQuotaIncidentForWorker(runId: string, workerId: string) {
  const rows = await db.select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, runId),
      eq(recoveryIncidents.workerId, workerId),
      eq(recoveryIncidents.kind, "quota_exhausted"),
    ))
    .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
    .limit(1);
  return rows[0] ?? null;
}

async function reserveReplacementWorkerRow(args: {
  runId: string;
  workerType: SupportedWorkerType;
  cwd: string;
  title: string;
  initialPrompt: string;
  launchModel: string | null;
  launchEffort: string | null;
  launchCredentialSource: "gateway" | "account";
}) {
  return runQuotaRecoveryMutation(args.runId, async () => {
    const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
    if (!run || isTerminalRunStatus(run.status) || normalizeRunStatus(run.status) === "canceled") {
      return null;
    }
    const { workerId, workerNumber } = await allocateWorkerIdentity(args.runId);
    await db.insert(workers).values({
      id: workerId,
      runId: args.runId,
      type: args.workerType,
      status: "starting",
      cwd: args.cwd,
      workerNumber,
      title: args.title,
      initialPrompt: args.initialPrompt,
      effectiveLaunchModel: args.launchModel,
      effectiveLaunchEffort: args.launchEffort,
      launchCredentialSource: args.launchCredentialSource,
      outputLog: "",
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    emitNamedEvent({ kind: "worker.spawned", runId: args.runId, workerId, workerType: args.workerType });
    notifyEventStreamSubscribers();
    return workerId;
  });
}

async function tearDownOutgoingWorker(workerId: string) {
  try {
    await bridge.cancelAgent(workerId);
  } catch {
    // best-effort teardown — quota-exhausted workers are often unresponsive
  }
}

async function abandonReplacementWorker(args: {
  runId: string;
  workerId: string;
}) {
  abortWorkerTurn(args.workerId, "quota recovery ownership lost");
  void bridge.cancelAgent(args.workerId).catch(() => {
    // best effort: the replacement may have been refused before it spawned
  });
  const worker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
  if (!worker || worker.status === "cancelled" || worker.status === "canceled") {
    return;
  }
  await advanceWorkerTurnGeneration(args.workerId, {
    status: "cancelled",
    clearCurrentText: true,
    updatedAt: new Date(),
  });
  emitNamedEvent({
    kind: "worker.status",
    runId: args.runId,
    workerId: args.workerId,
    prev: worker.status,
    next: "cancelled",
  });
  emitNamedEvent({
    kind: "worker.terminal",
    runId: args.runId,
    workerId: args.workerId,
    status: "cancelled",
  });
}

async function refuseFailoverIfTerminal(args: {
  runId: string;
  outgoingWorkerId: string;
  incidentId?: string | null;
  replacementWorkerId?: string | null;
  now: Date;
}): Promise<Extract<AttemptWorkerFailoverResult, { state: "ignored" }> | null> {
  const refused = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.outgoingWorkerId,
    incidentId: args.incidentId,
    now: args.now,
  });
  if (!refused) {
    return null;
  }
  if (args.replacementWorkerId) {
    await abandonReplacementWorker({ runId: args.runId, workerId: args.replacementWorkerId });
  }
  return { state: "ignored", reason: refused.reason };
}

async function recordFailoverEvent(args: {
  runId: string;
  workerId: string | null;
  type: string;
  details: Record<string, unknown>;
}) {
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    planItemId: null,
    eventType: args.type,
    details: args.details,
  });
}

/**
 * Attempt to switch the run from the outgoing (quota-exhausted) worker
 * to the next available worker in the priority list. If no replacement
 * is available, the run is parked in `quota_waiting` via
 * `parkRunForQuotaWait`. On any failure during handoff or spawn, parks
 * the run too — failover is best-effort.
 *
 * Emits the `worker.failover_started` / `worker.handoff_emitted` /
 * `worker.failover_completed` / `worker.failover_failed` named events
 * along the way so that lifecycle tests and clients can observe each
 * step deterministically.
 */
export async function attemptWorkerFailover(
  args: AttemptWorkerFailoverArgs,
): Promise<AttemptWorkerFailoverResult> {
  const now = args.now ?? new Date();
  const allowedTypes = args.allowedTypes;
  const maxAttempts = args.maxAttempts ?? Math.max(1, allowedTypes.length);

  const initialRefusal = await refuseFailoverIfTerminal({
    runId: args.runId,
    outgoingWorkerId: args.outgoingWorkerId,
    incidentId: args.existingBlock?.incidentId,
    now,
  });
  if (initialRefusal) {
    return initialRefusal;
  }

  const block = args.existingBlock ?? (await recordWorkerQuotaBlock({
    runId: args.runId,
    workerId: args.outgoingWorkerId,
    text: args.quotaText,
    provider: args.outgoingWorkerType,
    now,
    failoverPending: true,
  }));
  if ("state" in block) {
    return { state: "ignored", reason: block.reason };
  }

  const postBlockRefusal = await refuseFailoverIfTerminal({
    runId: args.runId,
    outgoingWorkerId: args.outgoingWorkerId,
    incidentId: block.incidentId,
    now,
  });
  if (postBlockRefusal) {
    return postBlockRefusal;
  }
  const outgoingWorker = await db.select().from(workers).where(eq(workers.id, args.outgoingWorkerId)).get();
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  const launchSelection = resolveWorkerLaunchSelection(outgoingWorker ?? {}, run ?? {});

  let replacementSelection: Awaited<ReturnType<typeof selectSpawnableWorkerTypeAsync>> | null = null;
  let replacementSelectionError: unknown = null;
  try {
    replacementSelection = await selectSpawnableWorkerTypeAsync(
      args.outgoingWorkerType,
      args.env,
      allowedTypes,
      { now },
    );
  } catch (error) {
    replacementSelectionError = error;
    // No spawnable worker — treat as "no_replacement" rather than a hard
    // failure: the run will be parked in quota_waiting like today.
  }

  const gatewayCompatibilityFailure = launchSelection.credentialSource === "gateway"
    && replacementSelection?.type !== "claude"
    ? "A gateway-routed Claude worker cannot fail over to a non-Claude replacement."
    : null;

  if (!replacementSelection || replacementSelection.type === args.outgoingWorkerType || gatewayCompatibilityFailure) {
    await setIncidentFailoverFlag(block.incidentId, "resolved");
    const park = await parkRunForQuotaWait({
      runId: args.runId,
      workerId: args.outgoingWorkerId,
      incidentId: block.incidentId,
      quota: block.quota,
      now,
    });
    if (park.state === "ignored") {
      return { state: "ignored", reason: park.reason };
    }
    const selectionFailureReason = gatewayCompatibilityFailure ?? (replacementSelectionError instanceof Error
      ? replacementSelectionError.message
      : replacementSelectionError
        ? String(replacementSelectionError)
        : null);
    if (selectionFailureReason) {
      await recordFailoverEvent({
        runId: args.runId,
        workerId: args.outgoingWorkerId,
        type: "worker_failover_failed",
        details: {
          summary: "Worker failover could not select a replacement worker.",
          stage: "selection",
          reason: selectionFailureReason,
          allowedTypes,
          outgoingWorkerType: args.outgoingWorkerType,
        },
      });
      emitNamedEvent({
        kind: "worker.failover_failed",
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        stage: "selection",
        reason: truncate(selectionFailureReason),
      });
    }
    return {
      state: "no_replacement",
      reason: gatewayCompatibilityFailure
        ? gatewayCompatibilityFailure
        : replacementSelection
        ? `No alternative worker is available (only ${args.outgoingWorkerType} allowed/spawnable).`
        : selectionFailureReason
          ? `Worker availability check failed: ${selectionFailureReason}`
          : `All allowed worker types are quota-blocked.`,
    };
  }

  const replacementType = replacementSelection.type;

  const preHandoffRefusal = await refuseFailoverIfTerminal({
    runId: args.runId,
    outgoingWorkerId: args.outgoingWorkerId,
    incidentId: block.incidentId,
    now,
  });
  if (preHandoffRefusal) {
    return preHandoffRefusal;
  }

  emitNamedEvent({
    kind: "worker.failover_started",
    runId: args.runId,
    outgoingWorkerId: args.outgoingWorkerId,
    outgoingType: args.outgoingWorkerType,
    reason: "quota_exhausted",
  });
  await recordFailoverEvent({
    runId: args.runId,
    workerId: args.outgoingWorkerId,
    type: "worker_failover_started",
    details: {
      summary: `Failing over from ${args.outgoingWorkerType} to ${replacementType}.`,
      outgoingType: args.outgoingWorkerType,
      newType: replacementType,
      reason: "quota_exhausted",
      incidentId: block.incidentId,
    },
  });

  const policy = await getRecoveryPolicy();
  const handoffRequest = await requestWorkerHandoff({
    runId: args.runId,
    workerId: args.outgoingWorkerId,
    reason: "quota_exhausted",
    timeoutMs: args.handoffTimeoutMs ?? policy.maxHandoffWaitMs,
  });

  let handoff: HandoffReport;
  if (handoffRequest.ok) {
    handoff = handoffRequest.report;
  } else {
    handoff = await buildSyntheticHandoff({
      runId: args.runId,
      workerId: args.outgoingWorkerId,
      reason: "quota_exhausted",
      originalPrompt: args.originalPrompt,
    });
  }
  const postHandoffRefusal = await refuseFailoverIfTerminal({
    runId: args.runId,
    outgoingWorkerId: args.outgoingWorkerId,
    incidentId: block.incidentId,
    now,
  });
  if (postHandoffRefusal) {
    return postHandoffRefusal;
  }
  emitNamedEvent({
    kind: "worker.handoff_emitted",
    runId: args.runId,
    outgoingWorkerId: args.outgoingWorkerId,
    source: handoff.source,
  });
  await recordFailoverEvent({
    runId: args.runId,
    workerId: args.outgoingWorkerId,
    type: "worker_handoff_emitted",
    details: {
      summary: `Captured ${handoff.source} handoff from ${args.outgoingWorkerId}.`,
      source: handoff.source,
      reason: handoffRequest.ok ? null : handoffRequest.reason,
    },
  });

  await tearDownOutgoingWorker(args.outgoingWorkerId);

  const seed = renderHandoffSeed({ report: handoff, originalPrompt: args.originalPrompt });

  let attempts = 0;
  let currentType: SupportedWorkerType = replacementType;
  let lastError: unknown = null;
  const blockedNow = new Set<SupportedWorkerType>([args.outgoingWorkerType]);
  while (attempts < maxAttempts) {
    attempts += 1;
    let newWorkerId: string | null = null;
    let replacementTurnGeneration: number | null = null;
    try {
      const preAttemptRefusal = await refuseFailoverIfTerminal({
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        incidentId: block.incidentId,
        now: new Date(),
      });
      if (preAttemptRefusal) {
        return preAttemptRefusal;
      }
      await prepareClaudeGatewayLaunch({
        type: currentType,
        model: launchSelection.model,
        accountId: launchSelection.accountId,
        runId: args.runId,
        workerId: args.outgoingWorkerId,
      });
      newWorkerId = await reserveReplacementWorkerRow({
        runId: args.runId,
        workerType: currentType,
        cwd: args.cwd,
        title: args.title,
        initialPrompt: seed,
        launchModel: launchSelection.model,
        launchEffort: launchSelection.effort,
        launchCredentialSource: launchSelection.credentialSource,
      });
      if (!newWorkerId) {
        const refused = await refuseFailoverIfTerminal({
          runId: args.runId,
          outgoingWorkerId: args.outgoingWorkerId,
          incidentId: block.incidentId,
          now: new Date(),
        });
        if (refused) {
          return refused;
        }
        throw new Error(`Replacement worker reservation was refused for run ${args.runId}.`);
      }
      replacementTurnGeneration = await readWorkerTurnGeneration(newWorkerId);
      const postReserveRefusal = await refuseFailoverIfTerminal({
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        incidentId: block.incidentId,
        replacementWorkerId: newWorkerId,
        now: new Date(),
      });
      if (postReserveRefusal) {
        return postReserveRefusal;
      }
      const accountAllocation = launchSelection.credentialSource === "gateway" ? null : await allocateWorkerAccount({
        workerType: currentType,
        runId: args.runId,
        workerId: newWorkerId,
        explicitAccountId: run?.preferredWorkerAccountId ?? null,
        strategy: run?.preferredWorkerAccountId ? "manual" : "subscription_then_api",
        env: compactEnv(args.env),
      });
      const workerAccountId = accountAllocation?.account?.id ?? null;
      const spawned = await bridge.spawnAgent({
        type: currentType,
        cwd: args.cwd,
        name: newWorkerId,
        env: compactEnv(args.env),
        ...(workerAccountId ? { accountId: workerAccountId } : {}),
        ...(launchSelection.model ? { model: launchSelection.model } : {}),
        ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
      });
      await db.update(workers).set({
        bridgeSessionId: spawned.sessionId ?? null,
        bridgeSessionMode: spawned.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, newWorkerId));

      const prePromptRefusal = await refuseFailoverIfTerminal({
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        incidentId: block.incidentId,
        replacementWorkerId: newWorkerId,
        now: new Date(),
      });
      if (prePromptRefusal) {
        return prePromptRefusal;
      }
      const response = await runWorkerTurn(newWorkerId, () => bridge.askAgent(
        newWorkerId!,
        seed,
        undefined,
        { expectedTurnGeneration: replacementTurnGeneration ?? undefined },
      ));
      const postPromptRefusal = await refuseFailoverIfTerminal({
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        incidentId: block.incidentId,
        replacementWorkerId: newWorkerId,
        now: new Date(),
      });
      if (postPromptRefusal) {
        return postPromptRefusal;
      }
      await appendSupervisorInputOnDelivery({
        runId: args.runId,
        workerId: newWorkerId,
        text: seed,
        deliveredAt: new Date(),
      });
      let snapshot: Awaited<ReturnType<typeof bridge.getAgent>> | null = null;
      try {
        snapshot = await bridge.getAgent(newWorkerId);
        await persistWorkerSnapshot(newWorkerId, snapshot);
      } catch {
        // The ask response still determines visible state if the bridge drops the worker quickly.
      }
      const latestWorker = await db.select().from(workers).where(eq(workers.id, newWorkerId)).get();
      const persistedWorker = await db.update(workers).set({
        status: response.state,
        outputLog: appendWorkerOutput(latestWorker?.outputLog, response.response),
        currentText: snapshot?.currentText ?? latestWorker?.currentText ?? "",
        lastText: snapshot?.lastText || latestWorker?.lastText || response.response,
        updatedAt: new Date(),
      }).where(and(
        eq(workers.id, newWorkerId),
        eq(workers.turnGeneration, replacementTurnGeneration ?? 0),
      )).returning({ id: workers.id });
      if (persistedWorker.length === 0) {
        const refused = await refuseFailoverIfTerminal({
          runId: args.runId,
          outgoingWorkerId: args.outgoingWorkerId,
          incidentId: block.incidentId,
          replacementWorkerId: newWorkerId,
          now: new Date(),
        });
        if (refused) {
          return refused;
        }
        throw new Error(`Replacement worker ${newWorkerId} was superseded before failover completed.`);
      }
      await recordFailoverEvent({
        runId: args.runId,
        workerId: newWorkerId,
        type: "worker_prompted",
        details: {
          summary: `Sent failover handoff seed to ${newWorkerId}.`,
          prompt: seed,
          reason: "worker_failover",
          outgoingWorkerId: args.outgoingWorkerId,
          handoffSource: handoff.source,
        },
      });

      const runTransitionRefusal = await runQuotaRecoveryMutation(args.runId, async () => {
        const refused = await transitionRunForQuotaRecovery({
          runId: args.runId,
          workerId: args.outgoingWorkerId,
          incidentId: block.incidentId,
          now: new Date(),
          updates: {
            status: "running",
            failedAt: null,
            lastError: null,
            updatedAt: new Date(),
          },
        });
        if (refused) return refused;
        await markRecoveryIncidentResolved({
          incidentId: block.incidentId,
          runId: args.runId,
          workerId: args.outgoingWorkerId,
          summary: "Worker failover completed after quota exhaustion.",
          details: {
            ...block.details,
            recoveryState: "failover_completed",
            recommendedAction: "none",
            failover_pending: false,
            failover_resolved_at: new Date().toISOString(),
            outgoingWorkerId: args.outgoingWorkerId,
            outgoingType: args.outgoingWorkerType,
            newWorkerId,
            newType: currentType,
            handoffSource: handoff.source,
          },
        });
        return null;
      });
      if (runTransitionRefusal) {
        await abandonReplacementWorker({ runId: args.runId, workerId: newWorkerId });
        return { state: "ignored", reason: runTransitionRefusal.reason };
      }
      const postCompletionRefusal = await refuseFailoverIfTerminal({
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        incidentId: block.incidentId,
        replacementWorkerId: newWorkerId,
        now: new Date(),
      });
      if (postCompletionRefusal) {
        return postCompletionRefusal;
      }

      emitNamedEvent({
        kind: "worker.failover_completed",
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        newWorkerId,
        newType: currentType,
      });
      await recordFailoverEvent({
        runId: args.runId,
        workerId: newWorkerId,
        type: "worker_failover_completed",
        details: {
          summary: `Switched workers from ${args.outgoingWorkerType} to ${currentType}.`,
          outgoingWorkerId: args.outgoingWorkerId,
          outgoingType: args.outgoingWorkerType,
          newWorkerId,
          newType: currentType,
          handoffSource: handoff.source,
        },
      });

      return {
        state: "failed_over",
        newWorkerId,
        newType: currentType,
        handoff,
      };
    } catch (error) {
      lastError = error;
      const caughtRefusal = await refuseFailoverIfTerminal({
        runId: args.runId,
        outgoingWorkerId: args.outgoingWorkerId,
        incidentId: block.incidentId,
        replacementWorkerId: newWorkerId,
        now: new Date(),
      });
      if (caughtRefusal) {
        return caughtRefusal;
      }
      const quotaInfo = extractQuotaResetInfo(error, { provider: currentType });
      if (quotaInfo.isQuotaError && newWorkerId) {
        const replacementBlock = await recordWorkerQuotaBlock({
          runId: args.runId,
          workerId: newWorkerId,
          text: quotaInfo.rawText,
          provider: currentType,
          now: new Date(),
        });
        if ("state" in replacementBlock) {
          await abandonReplacementWorker({ runId: args.runId, workerId: newWorkerId });
          return { state: "ignored", reason: replacementBlock.reason };
        }
        emitNamedEvent({
          kind: "worker.status",
          runId: args.runId,
          workerId: newWorkerId,
          prev: "starting",
          next: "cred-exhausted",
        });
        emitNamedEvent({
          kind: "error.surfaced",
          code: "worker.spawn.failed",
          message: `Worker ${currentType} hit quota on spawn during failover.`,
          surface: "log",
          runId: args.runId,
          workerId: newWorkerId,
          cause: {
            name: error instanceof Error ? error.name : "Error",
            message: truncate(quotaInfo.rawText),
          },
        });
        blockedNow.add(currentType);
        try {
          const next = await selectSpawnableWorkerTypeAsync(
            args.outgoingWorkerType,
            args.env,
            allowedTypes,
            { now: new Date() },
          );
          if (next.type === args.outgoingWorkerType || blockedNow.has(next.type)) {
            break;
          }
          currentType = next.type;
          continue;
        } catch {
          break;
        }
      } else {
        if (newWorkerId) await db.update(workers).set({
          status: "error",
          updatedAt: new Date(),
        }).where(eq(workers.id, newWorkerId));
        if (newWorkerId) emitNamedEvent({
          kind: "worker.status",
          runId: args.runId,
          workerId: newWorkerId,
          prev: "starting",
          next: "error",
        });
        emitNamedEvent({
          kind: "error.surfaced",
          code: "worker.spawn.failed",
          message: `Replacement worker spawn failed.`,
          surface: "log",
          runId: args.runId,
          ...(newWorkerId ? { workerId: newWorkerId } : {}),
          cause: {
            name: error instanceof Error ? error.name : "Error",
            message: truncate(error instanceof Error ? error.message : String(error)),
          },
        });
        break;
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : (lastError ? String(lastError) : "spawn exhausted allowed worker types");
  emitNamedEvent({
    kind: "worker.failover_failed",
    runId: args.runId,
    outgoingWorkerId: args.outgoingWorkerId,
    stage: "spawn",
    reason,
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "worker.failover.failed",
    message: `Worker failover failed during replacement spawn: ${reason}`,
    surface: "banner",
    runId: args.runId,
    workerId: args.outgoingWorkerId,
  });

  await setIncidentFailoverFlag(block.incidentId, "resolved");
  const park = await parkRunForQuotaWait({
    runId: args.runId,
    workerId: args.outgoingWorkerId,
    incidentId: block.incidentId,
    quota: block.quota,
    now: new Date(),
  });
  if (park.state === "ignored") {
    return { state: "ignored", reason: park.reason };
  }
  return { state: "park_failed", reason };
}

/**
 * Helper for callers (observer path, etc.) that have a runId but want
 * the supervisor to handle failover on the next tick. Marks the most
 * recent open quota incident with `failover_pending: true` so the
 * supervisor wake handler bypasses the quota_waiting early-return.
 */
export async function markIncidentForFailover(args: {
  runId: string;
  workerId: string;
}): Promise<boolean> {
  const refused = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    now: new Date(),
  });
  if (refused) return false;
  const incident = await findOpenQuotaIncidentForWorker(args.runId, args.workerId);
  if (!incident) return false;
  await setIncidentFailoverFlag(incident.id, true);
  const postMutationRefusal = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    incidentId: incident.id,
    now: new Date(),
  });
  if (postMutationRefusal) return false;
  return true;
}

/**
 * Read the latest open quota incident for a run; returns true when the
 * incident is currently flagged as failover-pending. Used by the
 * supervisor wake handler to decide whether to bypass the
 * quota_waiting early-return.
 */
export async function isRunPendingFailover(runId: string): Promise<boolean> {
  const rows = await db.select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, runId),
      eq(recoveryIncidents.kind, "quota_exhausted"),
    ))
    .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
    .limit(5);
  for (const row of rows) {
    if (row.status === "resolved" || row.status === "failed") continue;
    try {
      const details = row.details ? JSON.parse(row.details) : {};
      if (details && typeof details === "object" && (details as Record<string, unknown>).failover_pending === true) {
        return true;
      }
    } catch {
      // ignore malformed details
    }
  }
  return false;
}

/**
 * Find the most recent open quota incident for a run that is flagged
 * as failover-pending, returning the incident plus the worker context
 * the supervisor wake handler needs to run `attemptWorkerFailover`.
 */
export async function loadPendingFailoverContext(runId: string) {
  const rows = await db.select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, runId),
      eq(recoveryIncidents.kind, "quota_exhausted"),
    ))
    .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
    .limit(5);
  for (const row of rows) {
    if (row.status === "resolved" || row.status === "failed") continue;
    let details: Record<string, unknown> = {};
    try {
      const parsed: unknown = row.details ? JSON.parse(row.details) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        details = parsed as Record<string, unknown>;
      }
    } catch {
      details = {};
    }
    if (details.failover_pending !== true) continue;
    if (!row.workerId) continue;
    const worker = await db.select().from(workers).where(eq(workers.id, row.workerId)).get();
    if (!worker) continue;
    return {
      incident: row,
      worker,
      rawText: typeof details.rawText === "string" ? details.rawText : (row.lastError ?? ""),
    };
  }
  return null;
}

export { parseAllowedWorkerTypes, normalizeWorkerType };
