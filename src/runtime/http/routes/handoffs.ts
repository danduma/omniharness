import { randomUUID } from "node:crypto";
import { requireApiSession } from "@/server/auth/guards";
import { handoffCoordinator, reviseHandoffAdvisory } from "@/server/handoff/service";
import { getActiveHandoffForRun, getHandoffById } from "@/server/handoff/store";
import { SUPPORTED_WORKER_TYPES, normalizeWorkerType, type SupportedWorkerType } from "@/shared/worker-types";
import type { HandoffAdvisoryPatch, HandoffReason, HandoffTargetSelection } from "@/shared/handoff";
import type { OmniHttpHandler } from "@/runtime/http/registry";

function errorResponse(error: unknown) {
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  return Response.json({ error: {
    code: typeof candidate.code === "string" ? candidate.code : "handoff_failed",
    message: typeof candidate.message === "string" ? candidate.message : "The handoff failed.",
  } }, { status: typeof candidate.status === "number" ? candidate.status : 500 });
}

async function authenticate(request: Request, action: string) {
  return requireApiSession(request, { source: "Handoff", action, enforceSameOrigin: request.method !== "GET" });
}

function targetFrom(value: unknown): HandoffTargetSelection {
  if (!value || typeof value !== "object") throw Object.assign(new Error("A target CLI is required."), { status: 400 });
  const raw = value as Record<string, unknown>;
  const workerType = normalizeWorkerType(String(raw.workerType ?? ""));
  if (!SUPPORTED_WORKER_TYPES.includes(workerType as SupportedWorkerType)) throw Object.assign(new Error("Unsupported target CLI."), { status: 400 });
  return {
    workerType: workerType as SupportedWorkerType,
    model: typeof raw.model === "string" && raw.model.trim() ? raw.model.trim() : null,
    effort: typeof raw.effort === "string" && raw.effort.trim() ? raw.effort.trim().toLowerCase() : null,
    accountId: typeof raw.accountId === "string" && raw.accountId.trim() ? raw.accountId.trim() : null,
  };
}

function revisionFrom(value: unknown): number {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 1) throw Object.assign(new Error("A valid expectedRevision is required."), { status: 400 });
  return revision;
}

async function getScopedHandoff(request: Request, handoffId: string) {
  const sourceRunId = new URL(request.url).searchParams.get("runId")?.trim();
  if (!sourceRunId) throw Object.assign(new Error("A source run scope is required."), { status: 400, code: "handoff_scope_required" });
  const handoff = await getHandoffById(handoffId);
  if (!handoff || handoff.sourceRunId !== sourceRunId) {
    throw Object.assign(new Error("Handoff not found."), { status: 404, code: "handoff_not_found" });
  }
  return handoff;
}

export const handleRunHandoffsRequest: OmniHttpHandler = async (request, context) => {
  const auth = await authenticate(request, request.method === "GET" ? "Read a handoff" : "Prepare a handoff");
  if (auth.response) return auth.response;
  const runId = context.params?.id;
  if (!runId) return Response.json({ error: { code: "invalid_run", message: "Run id is required." } }, { status: 400 });
  try {
    if (request.method === "GET") return Response.json({ handoff: await getActiveHandoffForRun(runId) });
    const body = await request.json() as Record<string, unknown>;
    const reason = body.reason as HandoffReason;
    if (!(["manual_session", "manual_message", "quota_exhausted"] as const).includes(reason)) throw Object.assign(new Error("Invalid handoff reason."), { status: 400 });
    const handoff = await handoffCoordinator.prepare({
      sourceRunId: runId,
      sourceWorkerId: typeof body.sourceWorkerId === "string" ? body.sourceWorkerId : null,
      forkedFromMessageId: typeof body.forkedFromMessageId === "string" ? body.forkedFromMessageId : null,
      reason,
      target: targetFrom(body.target),
    });
    return Response.json({ handoff }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
};

export const handleHandoffRequest: OmniHttpHandler = async (request, context) => {
  const auth = await authenticate(request, "Read a handoff");
  if (auth.response) return auth.response;
  try {
    const scoped = await getScopedHandoff(request, context.params?.id ?? "");
    if (request.method === "PATCH") {
      const body = await request.json() as Record<string, unknown>;
      if (!body.advisory || typeof body.advisory !== "object" || Array.isArray(body.advisory)) throw Object.assign(new Error("An advisory patch is required."), { status: 400 });
      const patch: HandoffAdvisoryPatch = { expectedRevision: revisionFrom(body.expectedRevision), advisory: body.advisory as HandoffAdvisoryPatch["advisory"] };
      const handoff = await reviseHandoffAdvisory(scoped.id, patch);
      return Response.json({ handoff });
    }
    return Response.json({ handoff: scoped });
  } catch (error) {
    return errorResponse(error);
  }
};

export const handleHandoffLaunchRequest: OmniHttpHandler = async (request, context) => {
  const auth = await authenticate(request, "Launch a handoff");
  if (auth.response) return auth.response;
  try {
    const scoped = await getScopedHandoff(request, context.params?.id ?? "");
    const body = await request.json() as Record<string, unknown>;
    const handoff = await handoffCoordinator.launch({
      handoffId: scoped.id,
      expectedRevision: revisionFrom(body.expectedRevision),
      operationId: typeof body.operationId === "string" && body.operationId ? body.operationId : randomUUID(),
    });
    return Response.json({ handoff });
  } catch (error) {
    return errorResponse(error);
  }
};

export const handleHandoffCancelRequest: OmniHttpHandler = async (request, context) => {
  const auth = await authenticate(request, "Cancel a handoff");
  if (auth.response) return auth.response;
  try {
    const scoped = await getScopedHandoff(request, context.params?.id ?? "");
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const handoff = await handoffCoordinator.cancel(scoped.id, typeof body.reason === "string" ? body.reason : "user_cancelled", revisionFrom(body.expectedRevision));
    return Response.json({ handoff });
  } catch (error) {
    return errorResponse(error);
  }
};
