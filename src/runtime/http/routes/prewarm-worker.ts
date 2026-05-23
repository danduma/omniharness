import { prewarmWorker } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handlePrewarmWorkerRequest: OmniHttpHandler = async (request) => {
  try {
    const auth = await requireApiSession(toNextRequest(request), {
      source: "Agent runtime",
      action: "Prewarm worker",
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const type = typeof body.type === "string" ? body.type.trim() : "";
    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";
    if (!type) {
      return errorResponse("type is required", {
        status: 400,
        source: "Agent runtime",
        action: "Prewarm worker",
      });
    }
    if (!cwd) {
      return errorResponse("cwd is required", {
        status: 400,
        source: "Agent runtime",
        action: "Prewarm worker",
      });
    }
    const result = await prewarmWorker({
      type,
      cwd,
      model: typeof body.model === "string" ? body.model : null,
      mode: typeof body.mode === "string" ? body.mode : null,
    });
    return Response.json(result);
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Agent runtime",
      action: "Prewarm worker",
    });
  }
};
