import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

interface GeminiModelRecord {
  name?: string;
  baseModelId?: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

function normalizeGeminiModelId(model: GeminiModelRecord) {
  if (model.baseModelId?.trim()) {
    return model.baseModelId.trim();
  }

  if (model.name?.startsWith("models/")) {
    return model.name.slice("models/".length).trim();
  }

  return model.name?.trim() || null;
}

function isGenerateContentModel(model: GeminiModelRecord) {
  return model.supportedGenerationMethods?.includes("generateContent") ?? false;
}

async function listGeminiModels(apiKey: string) {
  const models: Array<{ id: string; label: string }> = [];
  let pageToken: string | null = null;

  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: {
        "x-goog-api-key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Gemini models request failed with status ${response.status}.`);
    }

    const payload = await response.json() as {
      models?: GeminiModelRecord[];
      nextPageToken?: string;
    };

    for (const model of payload.models ?? []) {
      if (!isGenerateContentModel(model)) {
        continue;
      }

      const id = normalizeGeminiModelId(model);
      if (!id) {
        continue;
      }

      models.push({
        id,
        label: model.displayName?.trim() || id,
      });
    }

    pageToken = payload.nextPageToken?.trim() || null;
  } while (pageToken);

  const seen = new Set<string>();
  return models
    .filter((model) => {
      if (seen.has(model.id)) {
        return false;
      }
      seen.add(model.id);
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

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
      apiKey?: string;
    };

    if (body.provider !== "gemini") {
      return errorResponse("Model discovery is currently supported for Gemini only.", {
        status: 400,
        source: "LLM Settings",
        action: "Fetch available models",
      });
    }

    if (!body.apiKey?.trim()) {
      return errorResponse("A Gemini API key is required to fetch available models.", {
        status: 400,
        source: "LLM Settings",
        action: "Fetch available models",
      });
    }

    const models = await listGeminiModels(body.apiKey.trim());
    return NextResponse.json({ models });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "LLM Settings",
      action: "Fetch available models",
    });
  }
}
