import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { CodeReviewRefusedError, reconcileOrphanedCodeReviews, startCodeReview } from "@/server/review/code-review";
import { listCodeReviewsForRun } from "@/server/review/store";
import type { OmniHttpHandler, OmniRequestContext } from "@/runtime/http/registry";

function requireRunId(context: OmniRequestContext) {
  const runId = context.params?.id?.trim();
  if (!runId) {
    throw new Error("Conversation id is required.");
  }
  return runId;
}

/** GET lists recent code cross-reviews for a conversation; POST starts one. */
export const handleCodeReviewsRequest: OmniHttpHandler = async (request, context) => {
  const action = request.method === "POST" ? "Start code cross-review" : "Load code cross-reviews";
  try {
    if (request.method !== "GET" && request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET, POST" },
      });
    }
    const auth = await requireApiSession(request, {
      source: "Code review",
      action,
      enforceSameOrigin: request.method === "POST",
    });
    if (auth.response) {
      return auth.response;
    }
    const runId = requireRunId(context);

    if (request.method === "GET") {
      await reconcileOrphanedCodeReviews(runId);
      return Response.json({ reviews: await listCodeReviewsForRun(runId) });
    }

    const body = await request.json().catch(() => ({})) as { implementerWorkerId?: unknown; maxRounds?: unknown };
    const result = await startCodeReview({
      runId,
      implementerWorkerId: typeof body.implementerWorkerId === "string" ? body.implementerWorkerId : null,
      maxRounds: typeof body.maxRounds === "number" ? body.maxRounds : undefined,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CodeReviewRefusedError) {
      // A refusal is an expected outcome, not a failure: return it as a typed
      // result so clients can show a translated reason. Already evented.
      return Response.json({ ok: false, refused: error.reason });
    }
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(error, {
      status: /not found/i.test(message) ? 404 : 500,
      source: "Code review",
      action,
    });
  }
};
