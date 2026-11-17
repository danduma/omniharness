/**
 * Shared setup for orchestration lifecycle scenarios: an Omni run in its
 * planning phase, the orchestration routes, and a deterministic binding
 * preflight (installed CLIs are environment, not behavior under test).
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, planningReviewFindings, planningReviewRounds, plans, runs } from "@/server/db/schema";
import { handleRunOrchestrationRequest } from "@/runtime/http/routes/orchestration";
import { getBuiltInWorkerModelOptions } from "@/server/worker-models";
import { SUPPORTED_WORKER_TYPES } from "@/shared/worker-types";
import type { BindingPreflightContext } from "@/server/orchestration/model-catalog";

export function deterministicPreflightContext(overrides: Partial<BindingPreflightContext> = {}): BindingPreflightContext {
  return {
    catalog: Object.fromEntries(SUPPORTED_WORKER_TYPES.map((type) => [type, getBuiltInWorkerModelOptions(type)])) as BindingPreflightContext["catalog"],
    availability: () => ({ installed: true, credentials: true }),
    isQuotaBlocked: async () => false,
    validateAccount: async () => undefined,
    decisionKeyConfigured: false,
    ...overrides,
  };
}

async function orchestrationRoute(request: Request, context: { params?: Promise<Record<string, string>> | Record<string, string> } = {}) {
  const params = context.params ? await context.params : {};
  return handleRunOrchestrationRequest(request, { surface: "test", params });
}

export const orchestrationRouteModule = { GET: orchestrationRoute, POST: orchestrationRoute };

export async function seedOmniPlanningRun(overrides: Partial<typeof runs.$inferInsert> = {}) {
  const planId = `plan-${Math.random().toString(36).slice(2, 10)}`;
  const runId = `run-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  await db.insert(plans).values({ id: planId, path: `/tmp/${planId}.md`, status: "pending", createdAt: now, updatedAt: now });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    phase: "planning",
    title: "Orchestrated lifecycle scenario",
    status: "running",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  await db.insert(messages).values({ id: `${runId}-m1`, runId, role: "user", content: "Add cache eviction with tests.", createdAt: now });
  return { planId, runId };
}

/** Rows the generic lifecycle cleanup does not know about. */
export async function clearOrchestrationScenarioRows(runId: string) {
  await db.delete(planningReviewFindings).where(eq(planningReviewFindings.runId, runId));
  await db.delete(planningReviewRounds).where(eq(planningReviewRounds.runId, runId));
  await db.delete(messages).where(eq(messages.runId, runId));
}

export function postAction(baseUrl: string, runId: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/api/runs/${runId}/orchestration`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
