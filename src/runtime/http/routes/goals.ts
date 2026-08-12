import { dbClient } from "@/server/db";
import { requireApiSession } from "@/server/auth/guards";
import { emitNamedEvent, type SurfacedErrorCode } from "@/server/events/named-events";
import { goalControl } from "@/server/runs/goal-control";
import { goalControlDispatchCoordinator, recoveryAction } from "@/server/runs/goal-control-dispatch";
import { goalOutboxDispatcher } from "@/server/runs/goal-outbox";
import { goalRateLimitManager } from "@/server/runs/goal-rate-limit";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import { attachGoalMutationToActiveWorker } from "@/server/runs/goal-worker-lease";
import {
  GOAL_ACTIONS,
  type GoalAction,
  type GoalMutationAction,
  type GoalMutationResult,
} from "@/shared/goal-plan";
import type { OmniHttpHandler } from "@/runtime/http/registry";

const MAX_GOAL_REQUEST_BYTES = 64 * 1024;
const MAX_IDENTIFIER_LENGTH = 128;

type MutationBody = {
  goalId: string;
  expectedRevision: number;
  operationId: string;
  objective?: string;
  action?: GoalAction;
};

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  const goal = extra.goal;
  return Response.json({
    error: {
      code,
      message,
      ...(goal && typeof goal === "object" ? { details: { goal } } : {}),
    },
    ...extra,
  }, { status });
}

function nonEmptyIdentifier(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function parseMutationBody(value: unknown, method: string): MutationBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    !nonEmptyIdentifier(candidate.goalId)
    || !nonEmptyIdentifier(candidate.operationId)
    || !Number.isSafeInteger(candidate.expectedRevision)
    || Number(candidate.expectedRevision) < 0
  ) {
    return null;
  }
  if (method === "PUT" && typeof candidate.objective !== "string") return null;
  if (method === "POST" && !GOAL_ACTIONS.includes(candidate.action as GoalAction)) return null;
  return {
    goalId: String(candidate.goalId).trim(),
    operationId: String(candidate.operationId).trim(),
    expectedRevision: Number(candidate.expectedRevision),
    ...(method === "PUT" ? { objective: candidate.objective as string } : {}),
    ...(method === "POST" ? { action: candidate.action as GoalAction } : {}),
  };
}

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GOAL_REQUEST_BYTES) {
    return { ok: false as const, response: errorResponse(413, "goal.payload_too_large", "The goal request is too large.") };
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { ok: false as const, response: errorResponse(415, "goal.payload.invalid", "The goal request must be JSON.") };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_GOAL_REQUEST_BYTES) {
    return { ok: false as const, response: errorResponse(413, "goal.payload_too_large", "The goal request is too large.") };
  }
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, response: errorResponse(400, "goal.payload.invalid", "The goal request is malformed.") };
  }
}

async function runExists(runId: string) {
  const result = await dbClient.execute({ sql: "SELECT id FROM runs WHERE id = ? LIMIT 1", args: [runId] });
  return Boolean(result.rows[0]);
}

function mutationFailureResponse(
  result: Extract<GoalMutationResult, { ok: false }>,
  details: { runId: string; goalId: string; operationId: string; action: GoalMutationAction },
) {
  const mapping: Record<typeof result.code, { status: number; publicCode: SurfacedErrorCode }> = {
    invalid_objective: { status: 400, publicCode: "goal.objective.invalid" },
    not_found: { status: 404, publicCode: "goal.persistence.failed" },
    revision_conflict: { status: 409, publicCode: "goal.revision_conflict" },
    operation_conflict: { status: 409, publicCode: "goal.revision_conflict" },
    invalid_transition: { status: 409, publicCode: "goal.transition.invalid" },
    stale_lease: { status: 409, publicCode: "goal.lease.stale" },
    unsupported_action: { status: 422, publicCode: "goal.action.unsupported" },
    provider_error: { status: 502, publicCode: "goal.acp.transport_failed" },
    persistence_error: { status: 500, publicCode: "goal.persistence.failed" },
  };
  const mapped = mapping[result.code];
  if (details.action === "set" || details.action === "edit") {
    emitNamedEvent({
      kind: "goal.set.refused",
      runId: details.runId,
      goalId: details.goalId,
      operationId: details.operationId,
      reason: result.code,
    });
  } else {
    emitNamedEvent({
      kind: "goal.action.refused",
      runId: details.runId,
      goalId: details.goalId,
      operationId: details.operationId,
      action: details.action,
      reason: result.code,
    });
  }
  emitNamedEvent({
    kind: "error.surfaced",
    code: mapped.publicCode,
    message: result.message,
    surface: "banner",
    runId: details.runId,
  });
  return Response.json({
    error: { code: mapped.publicCode, message: result.message, details: { goal: result.snapshot } },
    goal: result.snapshot,
  }, { status: mapped.status });
}

async function dispatchAndPublish(
  result: Extract<GoalMutationResult, { ok: true }>,
  action: GoalMutationAction,
  operationId: string,
) {
  const control = await goalControlDispatchCoordinator.dispatch(
    result.snapshot,
    result.replayed ? recoveryAction(result.snapshot) : action,
  );
  if (control.kind !== "unsupported" && control.kind !== "superseded" && action !== "set" && action !== "edit") {
      emitNamedEvent({
        kind: "goal.action.completed",
        runId: control.snapshot.runId,
        goalId: control.snapshot.goalId,
        operationId,
        action,
        revision: control.snapshot.revision,
      });
  }
  return control;
}

export const handleGoalRequest: OmniHttpHandler = async (request, context) => {
  const runId = context.params?.id?.trim();
  if (!runId) return errorResponse(400, "goal.payload.invalid", "A run id is required.");

  const auth = await requireApiSession(request, {
    action: request.method === "GET" ? "Read goal" : "Change goal",
    source: "Goal",
    enforceSameOrigin: request.method !== "GET",
  });
  if (auth.response) return auth.response;

  let exists: boolean;
  try {
    exists = await runExists(runId);
  } catch (error) {
    const message = redactGoalErrorMessage(error);
    emitNamedEvent({ kind: "error.surfaced", code: "goal.persistence.failed", message, surface: "banner", runId });
    return errorResponse(500, "goal.persistence.failed", "The goal state could not be loaded.");
  }
  if (!exists) {
    emitNamedEvent({ kind: "error.surfaced", code: "goal.not_found", message: "The run does not exist.", surface: "banner", runId });
    return errorResponse(404, "goal.not_found", "The run does not exist.");
  }
  if (request.method === "GET") {
    return Response.json({ goal: await goalControl.getGoal(runId) });
  }
  if (request.method !== "PUT" && request.method !== "POST") {
    emitNamedEvent({ kind: "error.surfaced", code: "goal.payload.invalid", message: "The goal request method is not supported.", surface: "banner", runId });
    return errorResponse(405, "goal.method_not_allowed", "The goal request method is not supported.");
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    emitNamedEvent({ kind: "error.surfaced", code: "goal.payload.invalid", message: "The goal request payload was rejected.", surface: "banner", runId });
    return parsedBody.response;
  }
  const body = parseMutationBody(parsedBody.value, request.method);
  if (!body) {
    emitNamedEvent({ kind: "error.surfaced", code: "goal.payload.invalid", message: "The goal request is invalid.", surface: "banner", runId });
    return errorResponse(400, "goal.payload.invalid", "The goal request is invalid.");
  }
  const principalId = auth.session?.id ?? `local:${context.surface}`;
  const rateLimit = goalRateLimitManager.check({ principalId, runId, endpoint: request.method });
  if (!rateLimit.allowed) {
    const message = "Too many goal changes were requested. Try again shortly.";
    emitNamedEvent(request.method === "PUT"
      ? { kind: "goal.set.refused", runId, goalId: body.goalId, operationId: body.operationId, reason: "rate_limited" }
      : { kind: "goal.action.refused", runId, goalId: body.goalId, operationId: body.operationId, action: body.action!, reason: "rate_limited" });
    emitNamedEvent({ kind: "error.surfaced", code: "goal.rate_limited", message, surface: "banner", runId });
    return Response.json({ error: { code: "goal.rate_limited", message } }, {
      status: 429,
      headers: { "retry-after": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))) },
    });
  }
  const currentGoal = request.method === "PUT" ? await goalControl.getGoal(runId) : null;
  const action: GoalMutationAction = request.method === "PUT"
    ? (!currentGoal || (currentGoal.status === "cleared" && currentGoal.goalId !== body.goalId) ? "set" : "edit")
    : body.action!;

  if (request.method === "PUT") {
    emitNamedEvent({ kind: "goal.set.started", runId, goalId: body.goalId, operationId: body.operationId });
  } else {
    emitNamedEvent({
      kind: "goal.action.started",
      runId,
      goalId: body.goalId,
      operationId: body.operationId,
      action: body.action!,
    });
  }

  let result: GoalMutationResult;
  try {
    result = request.method === "PUT"
      ? await goalControl.putGoal({
          runId,
          goalId: body.goalId,
          expectedRevision: body.expectedRevision,
          operationId: body.operationId,
          objective: body.objective!,
          principalId,
          endpoint: "goal.put",
        })
      : await goalControl.actionGoal({
          runId,
          goalId: body.goalId,
          expectedRevision: body.expectedRevision,
          operationId: body.operationId,
          action: body.action!,
          principalId,
          endpoint: "goal.actions",
        });
  } catch (error) {
    const message = redactGoalErrorMessage(error);
    emitNamedEvent(request.method === "PUT"
      ? { kind: "goal.set.failed", runId, goalId: body.goalId, operationId: body.operationId, reason: message }
      : { kind: "goal.action.failed", runId, goalId: body.goalId, operationId: body.operationId, action: body.action!, reason: message });
    emitNamedEvent({ kind: "error.surfaced", code: "goal.persistence.failed", message, surface: "banner", runId });
    return errorResponse(500, "goal.persistence.failed", "The goal could not be persisted.");
  }

  if (!result.ok) {
    return mutationFailureResponse(result, { runId, goalId: body.goalId, operationId: body.operationId, action });
  }

  const persistedResult = result;
  try {
    result = await attachGoalMutationToActiveWorker(persistedResult);
    if (result.snapshot.revision !== persistedResult.snapshot.revision) {
      const finalized = await goalControl.finalizeOperation(runId, body.operationId, result);
      if (!finalized) throw new Error("The goal operation result could not be updated after lease reconciliation.");
    }
  } catch (error) {
    const message = redactGoalErrorMessage(error);
    const failedResult: GoalMutationResult = {
      ok: false,
      code: "persistence_error",
      message,
      snapshot: persistedResult.snapshot,
    };
    try {
      await goalControl.finalizeOperation(runId, body.operationId, failedResult);
    } catch (finalizeError) {
      emitNamedEvent({
        kind: "goal.reconciliation.failed",
        runId,
        goalId: body.goalId,
        workerId: persistedResult.snapshot.workerId,
        reason: redactGoalErrorMessage(finalizeError),
      });
    }
    emitNamedEvent({
      kind: "goal.reconciliation.failed",
      runId,
      goalId: body.goalId,
      workerId: persistedResult.snapshot.workerId,
      reason: message,
    });
    emitNamedEvent(request.method === "PUT"
      ? { kind: "goal.set.failed", runId, goalId: body.goalId, operationId: body.operationId, reason: message }
      : { kind: "goal.action.failed", runId, goalId: body.goalId, operationId: body.operationId, action: body.action!, reason: message });
    emitNamedEvent({ kind: "error.surfaced", code: "goal.persistence.failed", message, surface: "banner", runId });
    await goalOutboxDispatcher.drainPending();
    return errorResponse(500, "goal.persistence.failed", "The goal was saved, but its active worker lease could not be reconciled.", {
      goal: persistedResult.snapshot,
    });
  }

  try {
    const control = await dispatchAndPublish(result, action, body.operationId);
    if (control.kind === "unsupported") {
      const failure = await goalControl.recordControlFailure(control.snapshot, "unsupported", control.reason);
      const snapshot = failure.ok ? failure.snapshot : failure.snapshot ?? control.snapshot;
      await goalControl.finalizeOperation(runId, body.operationId, {
        ok: false,
        code: "unsupported_action",
        message: "The active agent does not support this goal action.",
        snapshot,
      });
      await goalOutboxDispatcher.drainPending();
      const message = "The active agent does not support this goal action.";
      emitNamedEvent(request.method === "PUT"
        ? { kind: "goal.set.failed", runId, goalId: body.goalId, operationId: body.operationId, reason: control.reason }
        : { kind: "goal.action.failed", runId, goalId: body.goalId, operationId: body.operationId, action: body.action!, reason: control.reason });
      emitNamedEvent({ kind: "error.surfaced", code: "goal.action.unsupported", message, surface: "banner", runId });
      return errorResponse(422, "goal.action.unsupported", message, { goal: snapshot });
    }
    await goalOutboxDispatcher.drainPending();
    return Response.json({ goal: control.snapshot ?? result.snapshot, replayed: result.replayed, control });
  } catch (error) {
    const message = redactGoalErrorMessage(error);
    const failure = await goalControl.recordControlFailure(result.snapshot, "transport", message);
    const snapshot = failure.ok ? failure.snapshot : failure.snapshot ?? result.snapshot;
    await goalControl.finalizeOperation(runId, body.operationId, {
      ok: false,
      code: "provider_error",
      message,
      snapshot,
    });
    await goalOutboxDispatcher.drainPending();
    emitNamedEvent(request.method === "PUT"
      ? { kind: "goal.set.failed", runId, goalId: body.goalId, operationId: body.operationId, reason: message }
      : { kind: "goal.action.failed", runId, goalId: body.goalId, operationId: body.operationId, action: body.action!, reason: message });
    emitNamedEvent({ kind: "error.surfaced", code: "goal.acp.transport_failed", message, surface: "banner", runId });
    return errorResponse(502, "goal.acp.transport_failed", "The goal was saved, but the agent could not be updated.", {
      goal: snapshot,
    });
  }
};
