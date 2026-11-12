import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import {
  OrchestrationRefusedError,
  loadSavedOrchestrationPolicy,
  orchestrationService,
  saveOrchestrationPolicy,
} from "@/server/orchestration/service";
import {
  createDefaultOrchestrationPolicy,
  isTokenProfile,
  parseOrchestrationPolicy,
  resolveProfilePolicy,
} from "@/shared/orchestration-policy";
import type { OrchestrationAction } from "@/shared/orchestration-api";
import type { OmniHttpHandler, OmniRequestContext } from "@/runtime/http/registry";

/**
 * Orchestration HTTP adapters (plan Task 8). Route handlers only translate
 * HTTP to `orchestrationService` calls; they never touch orchestration
 * tables directly. Mutations require a same-origin session and accept an
 * `Idempotency-Key` header: a repeated key within the window returns the
 * first response instead of acting twice. Refusals and dispatch conflicts
 * are typed `{ ok: false }` results, not HTTP errors.
 */

const IDEMPOTENCY_WINDOW_MS = 10 * 60_000;
const IDEMPOTENCY_MAX_ENTRIES = 500;
const idempotentResponses = new Map<string, { expiresAt: number; status: number; body: unknown }>();

function idempotencyKey(request: Request, scope: string) {
  const key = request.headers.get("idempotency-key")?.trim();
  return key && key.length <= 200 ? `${scope}:${key}` : null;
}

async function withIdempotency(request: Request, scope: string, run: () => Promise<{ status: number; body: unknown }>) {
  const key = idempotencyKey(request, scope);
  const now = Date.now();
  if (key) {
    const cached = idempotentResponses.get(key);
    if (cached && cached.expiresAt > now) return Response.json(cached.body, { status: cached.status, headers: { "idempotent-replay": "true" } });
  }
  const result = await run();
  if (key) {
    idempotentResponses.set(key, { ...result, expiresAt: now + IDEMPOTENCY_WINDOW_MS });
    if (idempotentResponses.size > IDEMPOTENCY_MAX_ENTRIES) {
      for (const [entryKey, entry] of idempotentResponses) {
        if (entry.expiresAt <= now || idempotentResponses.size > IDEMPOTENCY_MAX_ENTRIES) idempotentResponses.delete(entryKey);
      }
    }
  }
  return Response.json(result.body, { status: result.status });
}

export function __resetOrchestrationIdempotencyForTests() {
  idempotentResponses.clear();
}

function methodNotAllowed(allow: string) {
  return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, { status: 405, headers: { allow } });
}

function refusal(error: OrchestrationRefusedError) {
  // A refusal is an expected, already-evented outcome returned as a typed
  // result (as code-reviews does), so clients can show a translated reason.
  return { status: 200, body: { ok: false, refused: error.reason } };
}

/** GET returns the saved default policy; PUT validates and saves one. */
export const handleOrchestrationPolicyRequest: OmniHttpHandler = async (request) => {
  const action = request.method === "PUT" ? "Save orchestration policy" : "Load orchestration policy";
  try {
    if (request.method !== "GET" && request.method !== "PUT") return methodNotAllowed("GET, PUT");
    const auth = await requireApiSession(request, { source: "Orchestration", action, enforceSameOrigin: request.method === "PUT" });
    if (auth.response) return auth.response;
    if (request.method === "GET") {
      return Response.json({ policy: await loadSavedOrchestrationPolicy(), defaults: createDefaultOrchestrationPolicy() });
    }
    const body = await request.json().catch(() => null) as { policy?: unknown } | null;
    return withIdempotency(request, "policy", async () => {
      const saved = await saveOrchestrationPolicy(body?.policy);
      if (!saved.ok) return { status: 400, body: { ok: false, issues: saved.issues } };
      notifyEventStreamSubscribers();
      return { status: 200, body: { ok: true, policy: saved.policy } };
    });
  } catch (error) {
    return errorResponse(error, { status: 500, source: "Orchestration", action });
  }
};

/** POST preflights a profile's bindings. Pure inspection: no rows are written. */
export const handleOrchestrationPreflightRequest: OmniHttpHandler = async (request) => {
  const action = "Preflight orchestration profile";
  try {
    if (request.method !== "POST") return methodNotAllowed("POST");
    const auth = await requireApiSession(request, { source: "Orchestration", action, enforceSameOrigin: true });
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => ({})) as { profile?: unknown; policy?: unknown };
    let policy = await loadSavedOrchestrationPolicy();
    if (body.policy !== undefined) {
      const parsed = parseOrchestrationPolicy(body.policy);
      if (!parsed.ok) return Response.json({ ok: false, issues: parsed.issues }, { status: 400 });
      policy = parsed.policy;
    }
    const profile = isTokenProfile(body.profile) ? body.profile : policy.defaultProfile;
    const report = await orchestrationService.preflightProfile(null, profile, resolveProfilePolicy(policy, profile));
    return Response.json({ ok: true, report });
  } catch (error) {
    return errorResponse(error, { status: 500, source: "Orchestration", action });
  }
};

function requireRunId(context: OmniRequestContext) {
  const runId = context.params?.id?.trim();
  if (!runId) throw new Error("Conversation id is required.");
  return runId;
}

const ACTIONS = new Set<OrchestrationAction>(["create", "select_profile", "preflight", "dispatch", "retry", "cancel"]);

/** GET returns the run's workflow snapshot; POST performs one workflow action. */
export const handleRunOrchestrationRequest: OmniHttpHandler = async (request, context) => {
  const action = request.method === "POST" ? "Control orchestration workflow" : "Load orchestration workflow";
  try {
    if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed("GET, POST");
    const auth = await requireApiSession(request, { source: "Orchestration", action, enforceSameOrigin: request.method === "POST" });
    if (auth.response) return auth.response;
    const runId = requireRunId(context);
    if (request.method === "GET") {
      return Response.json({ workflow: await orchestrationService.getWorkflowSnapshot(runId) });
    }
    const body = await request.json().catch(() => ({})) as { action?: unknown; profile?: unknown; policy?: unknown };
    const requested = typeof body.action === "string" && ACTIONS.has(body.action as OrchestrationAction) ? body.action as OrchestrationAction : null;
    if (!requested) return Response.json({ ok: false, error: { code: "invalid_action", message: "Unknown orchestration action." } }, { status: 400 });

    return withIdempotency(request, `run:${runId}:${requested}`, async () => {
      try {
        switch (requested) {
          case "create": {
            const created = await orchestrationService.createWorkflow({
              runId,
              profile: isTokenProfile(body.profile) ? body.profile : null,
              policy: body.policy,
            });
            return { status: 200, body: { ok: true, ...created } };
          }
          case "select_profile": {
            const selected = await orchestrationService.selectProfile({ runId, profile: String(body.profile ?? "") });
            return { status: 200, body: { ok: true, ...selected } };
          }
          case "preflight":
            return { status: 200, body: { ok: true, report: await orchestrationService.preflightWorkflow(runId) } };
          case "dispatch": {
            const result = await orchestrationService.dispatchNextStage(runId);
            return { status: 200, body: { ok: result.status !== "conflict", result } };
          }
          case "retry": {
            const result = await orchestrationService.retryStage(runId);
            return { status: 200, body: { ok: result.status !== "conflict", result } };
          }
          case "cancel":
            return { status: 200, body: { ok: true, ...(await orchestrationService.cancelWorkflow(runId)) } };
        }
      } catch (error) {
        if (error instanceof OrchestrationRefusedError) return refusal(error);
        throw error;
      } finally {
        notifyEventStreamSubscribers();
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(error, { status: /not found/i.test(message) ? 404 : 500, source: "Orchestration", action });
  }
};
