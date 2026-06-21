import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { promotePlanningRun } from "@/server/planning/promote";
import { startImplementationPhase } from "@/server/planning/transition";
import { startPlanningReview } from "@/server/planning/review";
import { parsePlanningReviewPreferences } from "@/server/planning/review-preferences";
import type { OmniHttpHandler, OmniRequestContext } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

function requirePlanningRunId(context: OmniRequestContext) {
  const runId = context.params?.id?.trim();
  if (!runId) {
    throw new Error("Planning run id is required.");
  }
  return runId;
}

export const handlePlanningReviewRequest: OmniHttpHandler = async (request, context) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Planning",
      action: "Review planning conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const prefs = parsePlanningReviewPreferences(body);
    const result = await startPlanningReview({
      runId: requirePlanningRunId(context),
      agentSelection: prefs.agentSelection,
      rounds: prefs.rounds,
    });

    notifyEventStreamSubscribers();

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[planning/review] failed:", error);
    const status = /not ready|no ready plan/i.test(message)
      ? 400
      : /not found/i.test(message)
        ? 404
        : /already in progress|already active/i.test(message)
          ? 409
          : 500;

    return errorResponse(error, {
      status,
      source: "Planning",
      action: "Review planning conversation",
    });
  }
};

export const handlePlanningPromoteRequest: OmniHttpHandler = async (request, context) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Planning",
      action: "Promote planning conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const runId = requirePlanningRunId(context);
    const planPath = typeof body?.planPath === "string" ? body.planPath : null;

    // Omni runs transition in place (same run); legacy planning-mode runs are
    // promoted into a separate implementation run.
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const result = run?.mode === "implementation" && run.phase === "planning"
      ? await startImplementationPhase({ runId, planPath })
      : await promotePlanningRun({ runId, planPath });
    notifyEventStreamSubscribers();

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /not ready|no verified plan/i.test(message)
      ? 400
      : /not found/i.test(message)
        ? 404
        : 500;

    return errorResponse(error, {
      status,
      source: "Planning",
      action: "Promote planning conversation",
    });
  }
};
