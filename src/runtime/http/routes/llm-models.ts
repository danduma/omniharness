import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

const LOCAL_MODEL_CATALOG = {
  gemini: [
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  ],
} as const;

export const handleLlmModelsRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "LLM Settings",
      action: "Fetch available models",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json() as {
      provider?: string;
    };

    if (body.provider !== "gemini") {
      return errorResponse("Model discovery is currently supported for Gemini only.", {
        status: 400,
        source: "LLM Settings",
        action: "Fetch available models",
      });
    }

    return Response.json({ models: LOCAL_MODEL_CATALOG.gemini });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "LLM Settings",
      action: "Fetch available models",
    });
  }
};
