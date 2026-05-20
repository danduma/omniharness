import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { resumeSupervisorRun } from "@/server/supervisor/resume";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handleRunResumeRequest: OmniHttpHandler = async (request, context) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Runs",
      action: "Resume run",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const runId = context.params?.id?.trim();
    if (!runId) {
      return errorResponse("run id is required", {
        status: 400,
        source: "Runs",
        action: "Resume run",
      });
    }

    const result = await resumeSupervisorRun(runId);
    notifyEventStreamSubscribers();

    return Response.json({ ok: true, runId, recovery: result });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Runs",
      action: "Resume run",
    });
  }
};
