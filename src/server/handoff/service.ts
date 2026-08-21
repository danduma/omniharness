import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { cancelAgent, getAgent, askAgent } from "@/server/bridge-client";
import { createConversation } from "@/server/conversations/create";
import {
  abortWorkerTurn,
  advanceWorkerTurnGeneration,
  waitForConversationBackgroundTasks,
  waitForConversationMutations,
} from "@/server/conversations/worker-turn-gate";
import { db } from "@/server/db";
import { conversationHandoffs, runs, settings, supervisorScheduledWakes, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { captureGitBaseline } from "@/server/git/auto-commit";
import { waitForRunMilestoneAutoCommit } from "@/server/git/run-auto-commit";
import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { validateExplicitWorkerAccount } from "@/server/accounts/account-allocator";
import { isWorkerTypeQuotaBlocked } from "@/server/quota/type-blocking";
import { normalizeWorkerType } from "@/server/supervisor/worker-types";
import { readWorkerEntriesTail, readWorkerLatestSeq } from "@/server/workers/output-store";
import {
  HANDOFF_READY_MAX_LIFETIME_MS,
  HANDOFF_PACKET_MAX_CHARACTERS,
  HANDOFF_STREAM_SETTLE_TIMEOUT_MS,
  AUTOMATIC_HANDOFF_COOLDOWN_MS,
  MAX_AUTOMATIC_HANDOFF_DEPTH,
  type HandoffRecordDto,
  type HandoffTargetSelection,
} from "@/shared/handoff";
import { gatherHandoffCandidates } from "./candidates";
import { compileHybridHandoffPacket, recomputeHybridHandoffContentHash, renderHybridHandoffSeed, type CompileHybridHandoffInput } from "./compiler";
import { createHandoffCoordinator, HandoffCoordinatorError, type PrepareHandoffInput } from "./coordinator";
import { parseHandoffReply } from "./parser";
import { HANDOFF_REQUEST_PROMPT } from "./render";
import { completeHandoffLaunch, createHandoffDraft, getHandoffById, saveHandoffPacket, transitionHandoff } from "./store";
import { computeWorkspaceFingerprint } from "./workspace-state";
import { redactHandoffList, redactHandoffText, sanitizeProjectRelativePath } from "./redaction";
import type { HandoffAdvisoryPatch } from "@/shared/handoff";
import { withWorkspaceMutationLock } from "./workspace-lock";
import { decodeClaudeGatewayModel } from "@/lib/claude-model-gateway";
import { getBuiltInWorkerModelOptions, type WorkerModelCatalog } from "@/server/worker-models";

function targetHash(target: HandoffTargetSelection): string {
  return createHash("sha256").update(JSON.stringify(target)).digest("hex");
}

const HANDOFF_EFFORTS: Record<HandoffTargetSelection["workerType"], ReadonlySet<string>> = {
  codex: new Set(["none", "minimal", "low", "medium", "high", "extra high", "extra-high", "xhigh", "max", "ultra"]),
  claude: new Set(["low", "medium", "high", "extra high", "extra-high", "xhigh", "max"]),
  gemini: new Set(["medium", "high"]),
  opencode: new Set(["low", "medium", "high", "extra high", "extra-high", "xhigh", "max", "ultra"]),
};
const CLAUDE_MODEL_ALIASES = new Set(["default", "opus", "sonnet", "haiku", "fable"]);

async function readCachedWorkerModels(workerType: HandoffTargetSelection["workerType"]): Promise<string[]> {
  const cached = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "__WORKER_MODEL_CATALOG_CACHE")).get();
  if (!cached?.value) return [];
  try {
    const parsed = JSON.parse(cached.value) as { catalog?: Partial<WorkerModelCatalog> } | Partial<WorkerModelCatalog>;
    const catalog = "catalog" in parsed ? parsed.catalog : parsed;
    return (catalog?.[workerType] ?? []).map((option) => option.value?.trim()).filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

export async function validateTargetLaunchOptions(target: HandoffTargetSelection) {
  if (target.effort && !HANDOFF_EFFORTS[target.workerType].has(target.effort.trim().toLowerCase())) {
    throw new HandoffCoordinatorError("handoff_target_unavailable", `Reasoning effort "${target.effort}" is not supported.`);
  }
  const model = target.model?.trim();
  if (!model) return;
  const knownModels = new Set([
    ...getBuiltInWorkerModelOptions(target.workerType).map((option) => option.value),
    ...await readCachedWorkerModels(target.workerType),
  ]);
  const knownAlias = target.workerType === "claude" && CLAUDE_MODEL_ALIASES.has(model.toLowerCase());
  const knownGatewayModel = target.workerType === "claude" && decodeClaudeGatewayModel(model) !== null;
  if (!knownModels.has(model) && !knownAlias && !knownGatewayModel) throw new HandoffCoordinatorError("handoff_target_unavailable", `Model "${model}" is not available for the ${target.workerType} CLI.`);
}

function lines(value: string | undefined): string[] {
  if (!value?.trim() || value.trim().toLowerCase() === "none") return [];
  return value.split(/\r?\n/).map((entry) => entry.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
}

async function readSource(input: PrepareHandoffInput) {
  const run = await db.select().from(runs).where(eq(runs.id, input.sourceRunId)).get();
  if (!run) throw new HandoffCoordinatorError("handoff_not_found", "Source conversation not found.", 404);
  const worker = input.sourceWorkerId
    ? await db.select().from(workers).where(and(eq(workers.id, input.sourceWorkerId), eq(workers.runId, run.id))).get() ?? null
    : await db.select().from(workers).where(eq(workers.runId, run.id)).orderBy(desc(workers.updatedAt), desc(workers.id)).limit(1).get() ?? null;
  return { run, worker };
}

function isMissingBridgeAgent(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 404;
}

async function observeAgent(workerId: string) {
  try {
    return await getAgent(workerId, { retryIndefinitely: false });
  } catch (error) {
    if (isMissingBridgeAgent(error)) return null;
    throw error;
  }
}

async function waitForWorkerStreamToSettle(runId: string, workerId: string): Promise<boolean> {
  const deadline = Date.now() + HANDOFF_STREAM_SETTLE_TIMEOUT_MS;
  let lastSeq = await readWorkerLatestSeq(runId, workerId);
  let stableReads = 0;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 75));
    const nextSeq = await readWorkerLatestSeq(runId, workerId);
    if (nextSeq === lastSeq) {
      stableReads += 1;
      if (stableReads >= 3) return true;
    } else {
      lastSeq = nextSeq;
      stableReads = 0;
    }
  }
  return false;
}

async function hasAcceptedInitialPrompt(runId: string, workerId: string): Promise<boolean> {
  const tail = await readWorkerEntriesTail(runId, workerId, 30);
  return Boolean(tail?.entries.some((entry) => (
    entry.type === "lifecycle"
    && entry.raw
    && typeof entry.raw === "object"
    && (entry.raw as Record<string, unknown>).eventType === "worker.prompt_accepted"
  )));
}

async function terminateSource(source: Awaited<ReturnType<typeof readSource>>): Promise<{ confirmed: boolean }> {
  await waitForRunMilestoneAutoCommit(source.run.id);
  const deadline = Date.now() + HANDOFF_STREAM_SETTLE_TIMEOUT_MS;
  await waitForConversationMutations(source.run.id, Math.max(1, deadline - Date.now()));
  await waitForConversationBackgroundTasks(source.run.id, Math.max(1, deadline - Date.now()));
  const stopRequested = new Set<string>();
  while (Date.now() < deadline) {
    const currentWorkers = await db.select().from(workers)
      .where(eq(workers.runId, source.run.id))
      .orderBy(desc(workers.createdAt), desc(workers.id));
    source.worker = currentWorkers[0] ?? null;
    if (currentWorkers.length === 0) return { confirmed: true };

    for (const worker of currentWorkers) {
      if (stopRequested.has(worker.id)) continue;
      stopRequested.add(worker.id);
      abortWorkerTurn(worker.id, "cross-cli handoff");
      await advanceWorkerTurnGeneration(worker.id, { status: "stopping", clearCurrentText: true, updatedAt: new Date() });
      try {
        await cancelAgent(worker.id);
      } catch (error) {
        const snapshot = await observeAgent(worker.id);
        if (snapshot && !["stopped", "cancelled", "error"].includes(snapshot.state)) throw error;
      }
    }

    let allStopped = true;
    for (const worker of currentWorkers) {
      const snapshot = await observeAgent(worker.id);
      if (snapshot && !["stopped", "cancelled", "error"].includes(snapshot.state)) {
        allStopped = false;
        continue;
      }
      await db.update(workers).set({ status: "cancelled", currentText: "", updatedAt: new Date() }).where(eq(workers.id, worker.id));
    }
    if (allStopped) {
      await waitForConversationMutations(source.run.id, Math.max(1, deadline - Date.now()));
      await waitForConversationBackgroundTasks(source.run.id, Math.max(1, deadline - Date.now()));
      const finalWorkers = await db.select().from(workers)
        .where(eq(workers.runId, source.run.id))
        .orderBy(desc(workers.createdAt), desc(workers.id));
      source.worker = finalWorkers[0] ?? null;
      if (finalWorkers.some((worker) => !stopRequested.has(worker.id))) continue;
      for (const worker of finalWorkers) {
        if (!await waitForWorkerStreamToSettle(source.run.id, worker.id)) return { confirmed: false };
      }
      return { confirmed: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  return { confirmed: false };
}

async function requestAdvisory(source: Awaited<ReturnType<typeof readSource>>, input: PrepareHandoffInput): Promise<CompileHybridHandoffInput["advisory"] | null> {
  if (!source.worker || input.reason === "quota_exhausted") return null;
  const snapshot = await getAgent(source.worker.id, { retryIndefinitely: false }).catch(() => null);
  if (!snapshot || snapshot.state !== "idle") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await askAgent(source.worker.id, HANDOFF_REQUEST_PROMPT, undefined, { signal: controller.signal });
    const parsed = parseHandoffReply({
      text: response.response,
      outgoingWorkerType: normalizeWorkerType(source.worker.type),
      outgoingWorkerId: source.worker.id,
      reason: input.reason,
    });
    if (!parsed.ok) return null;
    return {
      currentObjective: parsed.report.task,
      completed: lines(parsed.report.progress),
      remaining: lines(parsed.report.nextSteps),
      blockers: lines(parsed.report.blockers),
      openQuestions: lines(parsed.report.openQuestions),
      decisions: [],
      relevantFiles: parsed.report.relevantFiles ?? [],
      summarySource: "outgoing_worker",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function restoreSourceAfterUnsuccessfulHandoff(handoff: HandoffRecordDto, options: { forceNeedsRecovery?: boolean } = {}) {
  const futureWake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, handoff.sourceRunId)).get();
  if (options.forceNeedsRecovery) await db.delete(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, handoff.sourceRunId));
  await db.update(runs).set({
    status: !options.forceNeedsRecovery && futureWake && futureWake.wakeAt.getTime() > Date.now() ? "quota_waiting" : "needs_recovery",
    activeHandoffId: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, handoff.sourceRunId));
}

async function settleFailure(handoff: HandoffRecordDto, code: string, message: string) {
  let current = await getHandoffById(handoff.id);
  if (!current || current.status === "completed") return current;
  const target = await db.select({ id: runs.id, lastError: runs.lastError }).from(runs).where(eq(runs.originHandoffId, handoff.id)).get();
  const unsafeTarget = target?.lastError === "handoff_target_stop_unconfirmed";
  if (!["failed", "cancelled", "needs_recovery"].includes(current.status)) {
    try {
      current = await transitionHandoff({
        handoffId: current.id,
        expectedRevision: current.revision,
        from: [current.status],
        to: unsafeTarget ? "needs_recovery" : "failed",
        targetRunId: target?.id,
        lastError: `${code}: ${message}`,
      });
    } catch {
      // A reconciler may have won the terminal transition. Its durable state is
      // authoritative; never reopen the source from this stale error path.
      current = await getHandoffById(handoff.id);
    }
  }
  if (!current || current.status === "completed") return current;
  if (current.status === "needs_recovery" || unsafeTarget) {
    await db.delete(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, handoff.sourceRunId));
    await db.update(runs).set({
      status: "needs_recovery",
      activeHandoffId: handoff.id,
      updatedAt: new Date(),
    }).where(eq(runs.id, handoff.sourceRunId));
  } else if (current.status === "failed" || current.status === "cancelled") {
    await restoreSourceAfterUnsuccessfulHandoff(handoff);
  }
  const surfacedCode = code === "handoff_launch_failed"
    ? "handoff.launch_failed"
    : code === "handoff_source_changed"
      ? "handoff.source_changed"
      : code === "handoff_target_unavailable"
        ? "handoff.target_unavailable"
        : "handoff.capture_failed";
  emitNamedEvent({ kind: "error.surfaced", code: surfacedCode, message, surface: "toast", runId: handoff.sourceRunId });
  return current;
}

const unlockedHandoffCoordinator = createHandoffCoordinator({
  now: () => new Date(),
  randomId: randomUUID,
  getSource: readSource,
  async validateTarget(source, target, context) {
    if (!source.worker) throw new HandoffCoordinatorError("handoff_invalid_state", "The source conversation has no CLI worker to hand off.");
    if (source.run.mode !== "direct" && source.run.mode !== "commit") throw new HandoffCoordinatorError("handoff_invalid_state", "Cross-CLI handoff is only available for direct and commit conversations.");
    if (normalizeWorkerType(source.worker.type) === target.workerType) throw new HandoffCoordinatorError("handoff_invalid_state", "Choose a different CLI for this handoff.");
    await validateTargetLaunchOptions(target);
    const available = isSpawnableWorkerType(target.workerType);
    if (!available.ok) throw new HandoffCoordinatorError("handoff_target_unavailable", available.reason ?? "The target CLI is unavailable.");
    if (await isWorkerTypeQuotaBlocked(target.workerType)) throw new HandoffCoordinatorError("handoff_target_unavailable", "The target CLI is currently quota-blocked.");
    if (target.accountId) await validateExplicitWorkerAccount({ workerType: target.workerType, accountId: target.accountId });
    if (context.reason === "quota_exhausted") {
      let cursor: string | null = source.run.id;
      const recent: Array<{ workerType: string; accountId: string | null; completedAt: Date | null }> = [];
      let depth = 0;
      while (cursor && depth <= MAX_AUTOMATIC_HANDOFF_DEPTH) {
        const lineageRun: { parentRunId: string | null; originHandoffId: string | null } | undefined = await db.select({ parentRunId: runs.parentRunId, originHandoffId: runs.originHandoffId }).from(runs).where(eq(runs.id, cursor)).get();
        if (!lineageRun) break;
        if (lineageRun.originHandoffId) {
          const prior = await db.select({ workerType: conversationHandoffs.targetWorkerType, accountId: conversationHandoffs.targetAccountId, completedAt: conversationHandoffs.completedAt }).from(conversationHandoffs).where(eq(conversationHandoffs.id, lineageRun.originHandoffId)).get();
          if (prior) recent.push(prior);
          depth += 1;
        }
        cursor = lineageRun.parentRunId;
      }
      if (depth >= MAX_AUTOMATIC_HANDOFF_DEPTH) throw new HandoffCoordinatorError("handoff_target_unavailable", "Automatic cross-CLI handoff reached its safety depth limit.");
      if (recent.slice(0, 2).some((prior) => normalizeWorkerType(prior.workerType) === target.workerType || Boolean(target.accountId && prior.accountId === target.accountId))) {
        throw new HandoffCoordinatorError("handoff_target_unavailable", "The selected CLI or account was recently exhausted in this handoff chain.");
      }
      const latestCompletedAt = recent[0]?.completedAt?.getTime();
      if (latestCompletedAt && Date.now() - latestCompletedAt < AUTOMATIC_HANDOFF_COOLDOWN_MS) throw new HandoffCoordinatorError("handoff_target_unavailable", "Automatic cross-CLI handoff is cooling down before another provider change.");
    }
    const projectPath = path.resolve(source.run.projectPath ?? source.worker?.cwd ?? process.cwd());
    const liveRuns = await db.select({ id: runs.id, projectPath: runs.projectPath }).from(runs).where(inArray(runs.status, ["running", "working", "starting", "needs_recovery"]));
    const liveWorkers = await db.select({ runId: workers.runId, cwd: workers.cwd }).from(workers).innerJoin(runs, eq(workers.runId, runs.id)).where(inArray(runs.status, ["running", "working", "starting", "needs_recovery"]));
    if (liveRuns.some((run) => run.id !== source.run.id && run.projectPath && path.resolve(run.projectPath) === projectPath)
      || liveWorkers.some((worker) => worker.runId !== source.run.id && path.resolve(worker.cwd) === projectPath)) {
      throw new HandoffCoordinatorError("handoff_invalid_state", "Another live conversation already owns this checkout.");
    }
  },
  createDraft: (input, source) => {
    const projectPath = source.run.projectPath ?? source.worker?.cwd ?? process.cwd();
    return withWorkspaceMutationLock(projectPath, () => createHandoffDraft({
      sourceRunId: source.run.id,
      sourceWorkerId: source.worker?.id ?? null,
      forkedFromMessageId: input.forkedFromMessageId,
      normalizedProjectPath: path.resolve(projectPath),
      reason: input.reason,
      target: input.target,
      targetSelectionHash: targetHash(input.target),
      claimExpiresAt: new Date(Date.now() + HANDOFF_READY_MAX_LIFETIME_MS),
    }));
  },
  requestAdvisory,
  terminateSource,
  gatherCandidates: (source, input) => gatherHandoffCandidates({
    runId: source.run.id,
    workerId: source.worker?.id ?? null,
    forkedFromMessageId: input.forkedFromMessageId,
  }),
  compilePacket: compileHybridHandoffPacket,
  savePacket: (handoff, packet, candidates) => saveHandoffPacket({
    handoffId: handoff.id,
    expectedRevision: handoff.revision,
    packet,
    workspaceFingerprint: candidates.workspace.fingerprint,
    sourceWorkerId: candidates.worker?.id ?? null,
    sourceSeq: candidates.sourceSeq,
    claimExpiresAt: new Date(Date.now() + HANDOFF_READY_MAX_LIFETIME_MS),
  }),
  async markSourcePrepared(source, handoff) {
    await db.update(runs).set({ status: "needs_recovery", activeHandoffId: handoff.id, updatedAt: new Date() }).where(eq(runs.id, source.run.id));
  },
  getHandoff: getHandoffById,
  async getSourceFence(handoff) {
    const source = await readSource({ sourceRunId: handoff.sourceRunId, sourceWorkerId: handoff.sourceWorkerId, forkedFromMessageId: handoff.forkedFromMessageId, reason: handoff.reason, target: handoff.target });
    return {
      sourceSeq: source.worker ? await readWorkerLatestSeq(source.run.id, source.worker.id) : null,
      workspaceFingerprint: await computeWorkspaceFingerprint(source.run.projectPath ?? source.worker?.cwd ?? process.cwd()),
    };
  },
  claimLaunch: (handoff, operationId, claimToken) => transitionHandoff({
    handoffId: handoff.id,
    expectedRevision: handoff.revision,
    from: ["ready"],
    to: "launching",
    operationId,
    launchClaimToken: claimToken,
    claimExpiresAt: new Date(Date.now() + HANDOFF_STREAM_SETTLE_TIMEOUT_MS),
  }),
  async launchTarget(handoff) {
    if (!handoff.packet) throw new Error("The handoff packet is missing.");
    const source = await db.select().from(runs).where(eq(runs.id, handoff.sourceRunId)).get();
    if (!source) throw new Error("The source conversation no longer exists.");
    const projectPath = source.projectPath ?? process.cwd();
    const baseline = captureGitBaseline(projectPath);
    const created = await createConversation({
      mode: source.mode,
      command: renderHybridHandoffSeed(handoff.packet),
      projectPath,
      preferredWorkerType: handoff.target.workerType,
      preferredWorkerModel: handoff.target.model,
      preferredWorkerEffort: handoff.target.effort,
      preferredWorkerAccountId: handoff.target.accountId,
      allowedWorkerTypes: [handoff.target.workerType],
      originHandoffId: handoff.id,
      parentRunId: source.id,
      forkedFromMessageId: handoff.forkedFromMessageId,
      gitBaselineJsonOverride: JSON.stringify(baseline),
      bypassCommitWorkerSettings: true,
      bypassHandoffFence: true,
    });
    const targetWorker = await db.select().from(workers).where(eq(workers.runId, created.runId)).orderBy(desc(workers.createdAt)).limit(1).get();
    try {
      if (!targetWorker) throw new Error("The target conversation did not create a worker.");
      const deadline = Date.now() + HANDOFF_STREAM_SETTLE_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const snapshot = await observeAgent(targetWorker.id);
        const persisted = await db.select({ status: workers.status }).from(workers).where(eq(workers.id, targetWorker.id)).get();
        if (persisted && ["error", "failed"].includes(persisted.status)) throw new Error("The target CLI failed during startup.");
        if (
          snapshot
          && snapshot.state !== "starting"
          && persisted
          && persisted.status !== "starting"
          && await hasAcceptedInitialPrompt(created.runId, targetWorker.id)
        ) return { runId: created.runId, workerId: targetWorker.id };
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
      throw new Error("The target CLI did not become ready before the launch deadline.");
    } catch (error) {
      let stopped = !targetWorker;
      if (targetWorker) {
        try {
          await cancelAgent(targetWorker.id);
          const snapshot = await observeAgent(targetWorker.id);
          stopped = !snapshot || ["stopped", "cancelled", "error"].includes(snapshot.state);
        } catch (stopError) {
          stopped = isMissingBridgeAgent(stopError);
        }
        await db.update(workers).set({ status: stopped ? "error" : "stopping", updatedAt: new Date() }).where(eq(workers.id, targetWorker.id));
      }
      await db.update(runs).set({ status: stopped ? "failed" : "needs_recovery", lastError: stopped ? (error instanceof Error ? error.message : String(error)) : "handoff_target_stop_unconfirmed", updatedAt: new Date() }).where(eq(runs.id, created.runId));
      throw error;
    }
  },
  async completeLaunch(handoff, target) {
    return completeHandoffLaunch({ handoffId: handoff.id, expectedRevision: handoff.revision, sourceRunId: handoff.sourceRunId, targetRunId: target.runId });
  },
  settleFailure,
  async cancelHandoff(handoff, reason) {
    const cancelled = await transitionHandoff({ handoffId: handoff.id, expectedRevision: handoff.revision, from: ["capturing", "ready", "launching"], to: "cancelled", lastError: reason });
    await restoreSourceAfterUnsuccessfulHandoff(cancelled);
    return (await getHandoffById(handoff.id)) ?? cancelled;
  },
  emit: emitNamedEvent,
});

export const handoffCoordinator = {
  prepare: unlockedHandoffCoordinator.prepare,
  async launch(input: Parameters<typeof unlockedHandoffCoordinator.launch>[0]) {
    const handoff = await getHandoffById(input.handoffId);
    if (!handoff) return unlockedHandoffCoordinator.launch(input);
    const source = await db.select({ projectPath: runs.projectPath }).from(runs).where(eq(runs.id, handoff.sourceRunId)).get();
    return withWorkspaceMutationLock(source?.projectPath ?? process.cwd(), () => unlockedHandoffCoordinator.launch(input));
  },
  cancel: unlockedHandoffCoordinator.cancel,
};

export async function settleHandoffsForTargetDeletion(targetRunId: string) {
  const target = await db.select({ originHandoffId: runs.originHandoffId }).from(runs).where(eq(runs.id, targetRunId)).get();
  const rows = await db.select().from(conversationHandoffs).where(and(
    eq(conversationHandoffs.targetRunId, targetRunId),
    inArray(conversationHandoffs.status, ["capturing", "ready", "launching", "needs_recovery"]),
  ));
  if (target?.originHandoffId) {
    const origin = await db.select().from(conversationHandoffs).where(and(
      eq(conversationHandoffs.id, target.originHandoffId),
      inArray(conversationHandoffs.status, ["capturing", "ready", "launching", "needs_recovery"]),
    )).get();
    if (origin && !rows.some((row) => row.id === origin.id)) rows.push(origin);
  }
  for (const row of rows) {
    const handoff = await getHandoffById(row.id);
    if (!handoff) continue;
    const targetWorker = await db.select().from(workers).where(eq(workers.runId, targetRunId)).orderBy(desc(workers.createdAt), desc(workers.id)).limit(1).get();
    let stopped = !targetWorker;
    if (targetWorker) {
      try {
        await cancelAgent(targetWorker.id);
      } catch {
        // Confirmation below decides whether deletion and source recovery are safe.
      }
      try {
        const snapshot = await observeAgent(targetWorker.id);
        stopped = !snapshot || ["stopped", "cancelled", "error"].includes(snapshot.state);
      } catch {
        stopped = false;
      }
    }
    if (!stopped) {
      if (handoff.status !== "needs_recovery") {
        await transitionHandoff({ handoffId: handoff.id, expectedRevision: handoff.revision, from: [handoff.status], to: "needs_recovery", targetRunId, lastError: "handoff_target_stop_unconfirmed" });
      }
      await db.update(runs).set({ status: "needs_recovery", activeHandoffId: handoff.id, updatedAt: new Date() }).where(eq(runs.id, handoff.sourceRunId));
      throw new HandoffCoordinatorError("handoff_invalid_state", "The handoff target could not be confirmed stopped, so deletion was refused and both conversations remain fenced.");
    }
    await transitionHandoff({ handoffId: handoff.id, expectedRevision: handoff.revision, from: [handoff.status], to: "failed", lastError: "handoff_target_deleted" });
    await restoreSourceAfterUnsuccessfulHandoff(handoff);
    emitNamedEvent({ kind: "handoff.failed", runId: handoff.sourceRunId, handoffId: handoff.id, stage: "reconcile", code: "handoff_target_deleted", reason: "The partial target conversation was deleted." });
  }
}

export async function reviseHandoffAdvisory(handoffId: string, patch: HandoffAdvisoryPatch) {
  const handoff = await getHandoffById(handoffId);
  if (!handoff || !handoff.packet) throw new HandoffCoordinatorError("handoff_not_found", "Handoff packet not found.", 404);
  if (handoff.status !== "ready" || handoff.revision !== patch.expectedRevision) throw new HandoffCoordinatorError("handoff_invalid_state", "The handoff packet changed; refresh before editing.");
  const advisory = patch.advisory;
  const packet = structuredClone(handoff.packet);
  if (advisory.currentObjective !== undefined) packet.task.currentObjective = redactHandoffText(advisory.currentObjective, 2_000) || null;
  if (advisory.completed) packet.state.completed = redactHandoffList(advisory.completed, 40, 600);
  if (advisory.remaining) packet.state.remaining = redactHandoffList(advisory.remaining, 40, 600);
  if (advisory.blockers) packet.state.blockers = redactHandoffList(advisory.blockers, 30, 600);
  if (advisory.openQuestions) packet.state.openQuestions = redactHandoffList(advisory.openQuestions, 30, 600);
  if (advisory.rejectedApproaches) packet.state.rejectedApproaches = advisory.rejectedApproaches.slice(0, 20).map((entry) => ({ approach: redactHandoffText(entry.approach, 500), reason: redactHandoffText(entry.reason, 500) }));
  if (advisory.decisions) packet.decisions = advisory.decisions.slice(0, 40).map((entry) => ({ decision: redactHandoffText(entry.decision, 600), reason: entry.reason ? redactHandoffText(entry.reason, 600) : null, evidence: redactHandoffList(entry.evidence, 10, 300) }));
  if (advisory.relevantFiles) packet.workspace.relevantUnchangedFiles = advisory.relevantFiles.map(sanitizeProjectRelativePath).filter((value): value is string => Boolean(value)).sort().slice(0, 40);
  packet.provenance.summarySource = packet.provenance.summarySource === "synthetic" ? "synthetic" : "hybrid";
  if (JSON.stringify(packet).length > HANDOFF_PACKET_MAX_CHARACTERS) throw new HandoffCoordinatorError("handoff_invalid_state", "The edited handoff packet exceeds its size limit.", 400);
  packet.contentHash = recomputeHybridHandoffContentHash(packet);
  const revised = await saveHandoffPacket({ handoffId, expectedRevision: handoff.revision, packet, workspaceFingerprint: handoff.workspaceFingerprint, sourceSeq: handoff.sourceSeq, claimExpiresAt: new Date(Date.now() + HANDOFF_READY_MAX_LIFETIME_MS) });
  emitNamedEvent({ kind: "handoff.packet_revised", runId: handoff.sourceRunId, handoffId, revision: revised.revision });
  return revised;
}
