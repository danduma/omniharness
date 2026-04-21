import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/llm-models/route";

describe("POST /api/llm-models", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns normalized Gemini model ids that support generateContent", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [
          {
            name: "models/gemini-2.5-flash",
            baseModelId: "gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/embedding-001",
            baseModelId: "embedding-001",
            displayName: "Embedding 001",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
        nextPageToken: "page-2",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [
          {
            name: "models/gemini-2.5-flash",
            baseModelId: "gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new NextRequest("http://localhost/api/llm-models", {
      method: "POST",
      body: JSON.stringify({
        provider: "gemini",
        apiKey: "test-key",
      }),
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const payload = await response.json();
    expect(payload.models).toEqual([
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ]);
  });

  it("rejects unsupported providers", async () => {
    const response = await POST(new NextRequest("http://localhost/api/llm-models", {
      method: "POST",
      body: JSON.stringify({
        provider: "openai",
        apiKey: "test-key",
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "LLM Settings",
        action: "Fetch available models",
        message: "Model discovery is currently supported for Gemini only.",
      }),
    });
  });
});
