import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

const LOCAL_MODEL_CATALOG = {
  gemini: [
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  ],
} as const;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "LLM Settings",
      action: "Fetch available models",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json() as {
      provider?: string;
    };

    if (body.provider !== "gemini") {
      return errorResponse("Model discovery is currently supported for Gemini only.", {
        status: 400,
        source: "LLM Settings",
        action: "Fetch available models",
      });
    }

    return NextResponse.json({ models: LOCAL_MODEL_CATALOG.gemini });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "LLM Settings",
      action: "Fetch available models",
    });
  }
}
