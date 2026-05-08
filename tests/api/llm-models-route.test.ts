import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { encryptSettingValue } from "@/server/settings/crypto";
import { POST } from "@/app/api/llm-models/route";

describe("POST /api/llm-models", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(settings).where(eq(settings.key, "SUPERVISOR_LLM_API_KEY"));
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

  it("uses a saved encrypted Gemini credential for model discovery without returning the secret to the client", async () => {
    await db.insert(settings).values({
      key: "SUPERVISOR_LLM_API_KEY",
      value: encryptSettingValue("saved-gemini-key"),
      updatedAt: new Date(),
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      models: [
        {
          name: "models/gemini-3.1-pro-preview",
          displayName: "Gemini 3.1 Pro Preview",
          supportedGenerationMethods: ["generateContent"],
        },
      ],
    }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new NextRequest("http://localhost/api/llm-models", {
      method: "POST",
      body: JSON.stringify({
        provider: "gemini",
        apiKeySettingKey: "SUPERVISOR_LLM_API_KEY",
      }),
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      headers: {
        "x-goog-api-key": "saved-gemini-key",
      },
      cache: "no-store",
    }));

    await expect(response.json()).resolves.toEqual({
      models: [
        { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
      ],
    });
  });
});
