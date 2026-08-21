import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import {
  boundedGoalIdentityToken,
  isGoalRecord,
  normalizeAcpGoalMetadata,
  normalizeAcpGoalPlanUpdate,
  normalizeGoalFallbackCapabilities,
  type AcpGoalMetadataResult,
} from "./goal-normalization";

export {
  MAX_ACP_GOAL_COLLECTION_SIZE,
  MAX_ACP_GOAL_NESTING_DEPTH,
  MAX_ACP_GOAL_PAYLOAD_BYTES,
  normalizeAcpGoalMetadata,
  normalizeAcpGoalPlanUpdate,
  normalizeGoalFallbackCapabilities,
} from "./goal-normalization";
export type {
  AcpGoalMetadataResult,
  AcpGoalPlanResult,
  AcpGoalRejectionReason,
} from "./goal-normalization";

export type GoalSessionUpdateResult =
  | { kind: "ignored"; reason: "worker_not_persisted" | "goal_absent" | "not_goal_update" }
  | { kind: "accepted"; revision: number }
  | { kind: "rejected"; reason: string };

async function resolveRunIdForGoalWorker(workerId: string): Promise<string | null> {
  const [{ eq }, { db }, { workers }] = await Promise.all([
    import("drizzle-orm"),
    import("@/server/db"),
    import("@/server/db/schema"),
  ]);
  const worker = await db.select({ runId: workers.runId }).from(workers).where(eq(workers.id, workerId)).get();
  return worker?.runId ?? null;
}

function goalMetadataEnvelope(update: unknown) {
  if (!isGoalRecord(update) || !isGoalRecord(update._meta) || !isGoalRecord(update._meta.goal)) return null;
  return update;
}

export function isAcpGoalNotification(update: unknown) {
  if (goalMetadataEnvelope(update)) return true;
  if (!isGoalRecord(update)) return false;
  return update.sessionUpdate === "available_commands_update"
    || update.sessionUpdate === "plan"
    || update.sessionUpdate === "plan_update"
    || update.sessionUpdate === "plan_removed";
}

async function emitGoalPayloadRejection(args: {
  runId: string;
  goalId: string;
  workerId: string;
  reason: string;
}) {
  const { emitNamedEvent } = await import("@/server/events/named-events");
  emitNamedEvent({ kind: "goal.payload_rejected", ...args });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "goal.payload.invalid",
    message: `The agent sent an invalid goal update (${args.reason}).`,
    surface: "log",
    runId: args.runId,
    workerId: args.workerId,
  });
}

export async function handleAcpGoalSessionUpdateForWorker(args: {
  workerId: string;
  sessionId: string | null | undefined;
  update: unknown;
}): Promise<GoalSessionUpdateResult> {
  if (!isAcpGoalNotification(args.update)) return { kind: "ignored", reason: "not_goal_update" };
  const runId = await resolveRunIdForGoalWorker(args.workerId);
  if (!runId) return { kind: "ignored", reason: "worker_not_persisted" };
  const { goalControl } = await import("@/server/runs/goal-control");
  const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : null;
  let current = await goalControl.getGoal(runId);
  const metadata = goalMetadataEnvelope(args.update);
  const fallbackCommands = isGoalRecord(args.update)
    && args.update.sessionUpdate === "available_commands_update"
    && Array.isArray(args.update.availableCommands)
    ? args.update.availableCommands.flatMap((command) => (
        isGoalRecord(command) && typeof command.name === "string" ? [command.name] : []
      ))
    : null;
  let normalizedMetadata: AcpGoalMetadataResult | null = null;
  if (!current && metadata && sessionId) {
    normalizedMetadata = normalizeAcpGoalMetadata(metadata);
    if (!normalizedMetadata.ok || !normalizedMetadata.value.objective) {
      return { kind: "rejected", reason: normalizedMetadata.ok ? "invalid_objective" : normalizedMetadata.reason };
    }
    const providerGoalId = boundedGoalIdentityToken(normalizedMetadata.value.providerGoalId ?? "provider");
    const operationToken = boundedGoalIdentityToken(`${sessionId}\u0000${providerGoalId}`);
    const created = await goalControl.putGoal({
      runId,
      goalId: `${runId}:${providerGoalId}`,
      expectedRevision: 0,
      operationId: `acp-goal:${operationToken}`,
      principalId: `acp:${args.workerId}`,
      endpoint: "goal.put",
      objective: normalizedMetadata.value.objective,
    });
    if (!created.ok) return { kind: "rejected", reason: created.code };
    const attached = await goalControl.attachLease({
      runId,
      goalId: created.snapshot.goalId,
      expectedRevision: created.snapshot.revision,
      workerId: args.workerId,
      acpSessionId: sessionId,
    });
    if (!attached.ok) return { kind: "rejected", reason: attached.code };
    await goalControl.markControlApplied(attached.snapshot, "extension");
    current = attached.snapshot;
  }
  if (!current) return { kind: "ignored", reason: "goal_absent" };
  if (
    !sessionId
    || current.workerId !== args.workerId
    || current.acpSessionId !== sessionId
  ) {
    const { emitNamedEvent } = await import("@/server/events/named-events");
    emitNamedEvent({
      kind: "goal.stale_lease_ignored",
      runId,
      goalId: current.goalId,
      workerId: args.workerId,
      leaseGeneration: current.workerId === args.workerId ? current.leaseGeneration : 0,
      currentLeaseGeneration: current.leaseGeneration,
    });
    return { kind: "rejected", reason: "stale_lease" };
  }

  let update: Parameters<typeof goalControl.applyProviderUpdate>[0];
  if (metadata) {
    const normalized = normalizedMetadata ?? normalizeAcpGoalMetadata(metadata);
    if (!normalized.ok) {
      await emitGoalPayloadRejection({ runId, goalId: current.goalId, workerId: args.workerId, reason: normalized.reason });
      return { kind: "rejected", reason: normalized.reason };
    }
    if (normalized.value.objective && normalized.value.objective !== current.objective) {
      const { emitNamedEvent } = await import("@/server/events/named-events");
      emitNamedEvent({
        kind: "goal.reconciliation.refused",
        runId,
        goalId: current.goalId,
        workerId: args.workerId,
        reason: "provider_objective_conflict_durable_wins",
      });
    }
    update = {
      runId,
      goalId: current.goalId,
      expectedRevision: current.revision,
      workerId: args.workerId,
      acpSessionId: sessionId,
      leaseGeneration: current.leaseGeneration,
      status: normalized.value.status ?? undefined,
      capabilities: normalized.value.capabilities,
      validationState: normalized.value.validationState,
    };
  } else if (fallbackCommands) {
    update = {
      runId,
      goalId: current.goalId,
      expectedRevision: current.revision,
      workerId: args.workerId,
      acpSessionId: sessionId,
      leaseGeneration: current.leaseGeneration,
      capabilities: normalizeGoalFallbackCapabilities(fallbackCommands),
    };
  } else {
    const normalized = normalizeAcpGoalPlanUpdate(args.update, {
      goalId: current.goalId,
      revision: current.revision,
    });
    if (!normalized.ok) {
      await emitGoalPayloadRejection({ runId, goalId: current.goalId, workerId: args.workerId, reason: normalized.reason });
      return { kind: "rejected", reason: normalized.reason };
    }
    update = {
      runId,
      goalId: current.goalId,
      expectedRevision: current.revision,
      workerId: args.workerId,
      acpSessionId: sessionId,
      leaseGeneration: current.leaseGeneration,
      plan: normalized.value.plan,
      planSource: normalized.value.planSource,
    };
  }

  const result = await goalControl.applyProviderUpdate(update);
  const { emitNamedEvent } = await import("@/server/events/named-events");
  if (!result.ok) {
    if (result.code === "stale_lease" || result.code === "revision_conflict") {
      emitNamedEvent({
        kind: "goal.stale_lease_ignored",
        runId,
        goalId: current.goalId,
        workerId: args.workerId,
        leaseGeneration: current.leaseGeneration,
        currentLeaseGeneration: result.snapshot?.leaseGeneration ?? current.leaseGeneration,
      });
    } else {
      emitNamedEvent({
        kind: "goal.reconciliation.refused",
        runId,
        goalId: current.goalId,
        workerId: args.workerId,
        reason: result.code,
      });
    }
    return { kind: "rejected", reason: result.code };
  }
  const { goalOutboxDispatcher } = await import("@/server/runs/goal-outbox");
  await goalOutboxDispatcher.drainPending();
  return { kind: "accepted", revision: result.snapshot.revision };
}

export async function initializeWorkerGoalSession(
  workerId: string,
  sessionId: string,
  options: {
    dispatch?: (snapshot: import("@/shared/goal-plan").GoalSnapshot) => Promise<
      | { kind: "dispatched"; method: "extension" | "slash" }
      | { kind: "deferred"; reason: "no_active_lease" }
      | { kind: "unsupported"; reason: string }
    >;
  } = {},
) {
  const runId = await resolveRunIdForGoalWorker(workerId);
  if (!runId) return { kind: "ignored" as const, reason: "worker_not_persisted" as const };
  const [{ goalControl }, { emitNamedEvent }, { goalOutboxDispatcher }] = await Promise.all([
    import("@/server/runs/goal-control"),
    import("@/server/events/named-events"),
    import("@/server/runs/goal-outbox"),
  ]);
  const current = await goalControl.getGoal(runId);
  if (!current || !current.visible || current.status === "cleared") {
    return { kind: "ignored" as const, reason: "goal_absent" as const };
  }
  const attached = await goalControl.attachLease({
    runId,
    goalId: current.goalId,
    expectedRevision: current.revision,
    workerId,
    acpSessionId: sessionId,
  });
  if (!attached.ok) {
    emitNamedEvent({
      kind: "goal.reconciliation.refused",
      runId,
      goalId: current.goalId,
      workerId,
      reason: attached.code,
    });
    return { kind: "rejected" as const, reason: attached.code };
  }
  const snapshot = attached.snapshot;
  if (!attached.replayed && current.workerId !== workerId) {
    emitNamedEvent({
      kind: "goal.worker_transferred",
      runId,
      goalId: snapshot.goalId,
      previousWorkerId: current.workerId,
      workerId,
      leaseGeneration: snapshot.leaseGeneration,
    });
  }
  let settledSnapshot = snapshot;
  try {
    const { createGoalControlDispatchCoordinator, goalControlDispatchCoordinator } = await import(
      "@/server/runs/goal-control-dispatch"
    );
    const coordinator = options.dispatch
      ? createGoalControlDispatchCoordinator({
          getGoal: (goalRunId) => goalControl.getGoal(goalRunId),
          isControlSettled: (goalSnapshot) => goalControl.isControlSettled(goalSnapshot),
          dispatch: (goalSnapshot) => options.dispatch!(goalSnapshot),
          markControlApplied: (goalSnapshot, method, action) => goalControl.markControlApplied(goalSnapshot, method, action),
        })
      : goalControlDispatchCoordinator;
    const dispatched = await coordinator.dispatch(snapshot, "set");
    if (dispatched.snapshot) settledSnapshot = dispatched.snapshot;
    if (dispatched.kind === "unsupported") {
        await goalControl.recordControlFailure(dispatched.snapshot, "unsupported", dispatched.reason);
        await goalOutboxDispatcher.drainPending();
        emitNamedEvent({
          kind: "goal.reconciliation.refused",
          runId,
          goalId: dispatched.snapshot.goalId,
          workerId,
          reason: dispatched.reason,
        });
        emitNamedEvent({
          kind: "error.surfaced",
          code: "goal.action.unsupported",
          message: "The active agent does not advertise goal control support.",
          surface: "banner",
          runId,
          workerId,
        });
        return { kind: "rejected" as const, reason: dispatched.reason };
    }
    if (dispatched.kind === "superseded" || dispatched.kind === "deferred") {
      emitNamedEvent({
        kind: "goal.reconciliation.refused",
        runId,
        goalId: snapshot.goalId,
        workerId,
        reason: dispatched.reason,
      });
      return { kind: "rejected" as const, reason: dispatched.reason };
    }
  } catch (error) {
      const reason = redactGoalErrorMessage(error);
      await goalControl.recordControlFailure(snapshot, "transport", reason);
      await goalOutboxDispatcher.drainPending();
      emitNamedEvent({ kind: "goal.reconciliation.failed", runId, goalId: snapshot.goalId, workerId, reason });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "goal.reconciliation.failed",
        message: reason,
        surface: "banner",
        runId,
        workerId,
      });
      return { kind: "rejected" as const, reason };
  }
  await goalOutboxDispatcher.drainPending();
  emitNamedEvent({
    kind: "goal.reconciliation.completed",
    runId,
    goalId: settledSnapshot.goalId,
    workerId,
    revision: settledSnapshot.revision,
    leaseGeneration: settledSnapshot.leaseGeneration,
  });
  return { kind: "accepted" as const, snapshot: settledSnapshot };
}
