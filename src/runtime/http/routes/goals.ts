import { dbClient } from "@/server/db";
import { requireApiSession } from "@/server/auth/guards";
import { emitNamedEvent, type SurfacedErrorCode } from "@/server/events/named-events";
import { goalAcpDispatcher } from "@/server/runs/goal-acp";
import { goalControl } from "@/server/runs/goal-control";
import { goalOutboxDispatcher } from "@/server/runs/goal-outbox";
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
  return Response.json({ error: { code, message }, ...extra }, { status });
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
  return errorResponse(mapped.status, mapped.publicCode, result.message, { goal: result.snapshot });
}

async function dispatchAndPublish(
  result: Extract<GoalMutationResult, { ok: true }>,
  action: GoalMutationAction,
  operationId: string,
) {
  if (!result.replayed) {
    const control = await goalAcpDispatcher.dispatch(result.snapshot, action);
    if (action !== "set" && action !== "edit") {
      emitNamedEvent({
        kind: "goal.action.completed",
        runId: result.snapshot.runId,
        goalId: result.snapshot.goalId,
        operationId,
        action,
        revision: result.snapshot.revision,
      });
    }
    await goalOutboxDispatcher.drainPending();
    return control;
  }
  return { kind: "replayed" as const };
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

  if (!(await runExists(runId))) {
    return errorResponse(404, "goal.not_found", "The run does not exist.");
  }
  if (request.method === "GET") {
    return Response.json({ goal: await goalControl.getGoal(runId) });
  }
  if (request.method !== "PUT" && request.method !== "POST") {
    return errorResponse(405, "goal.method_not_allowed", "The goal request method is not supported.");
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parseMutationBody(parsedBody.value, request.method);
  if (!body) return errorResponse(400, "goal.payload.invalid", "The goal request is invalid.");
  const principalId = auth.session?.id ?? `local:${context.surface}`;
  const action: GoalMutationAction = request.method === "PUT"
    ? ((await goalControl.getGoal(runId)) ? "edit" : "set")
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
    const message = error instanceof Error ? error.message : String(error);
    const kind = request.method === "PUT" ? "goal.set.failed" : "goal.action.failed";
    emitNamedEvent(request.method === "PUT"
      ? { kind, runId, goalId: body.goalId, operationId: body.operationId, reason: message }
      : { kind, runId, goalId: body.goalId, operationId: body.operationId, action: body.action!, reason: message });
    emitNamedEvent({ kind: "error.surfaced", code: "goal.persistence.failed", message, surface: "banner", runId });
    return errorResponse(500, "goal.persistence.failed", "The goal could not be persisted.");
  }

  if (!result.ok) {
    return mutationFailureResponse(result, { runId, goalId: body.goalId, operationId: body.operationId, action });
  }

  try {
    const control = await dispatchAndPublish(result, action, body.operationId);
    return Response.json({ goal: result.snapshot, replayed: result.replayed, control });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitNamedEvent(request.method === "PUT"
      ? { kind: "goal.set.failed", runId, goalId: body.goalId, operationId: body.operationId, reason: message }
      : { kind: "goal.action.failed", runId, goalId: body.goalId, operationId: body.operationId, action: body.action!, reason: message });
    emitNamedEvent({ kind: "error.surfaced", code: "goal.acp.transport_failed", message, surface: "banner", runId });
    return errorResponse(502, "goal.acp.transport_failed", "The goal was saved, but the agent could not be updated.", {
      goal: result.snapshot,
    });
  }
};
