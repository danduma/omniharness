import { afterEach, describe, expect, it, vi } from "vitest";
import { llmModelsRoute as POST } from "@/../tests/helpers/runtime-routes";

describe("POST /api/llm-models", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns local Gemini model ids without fetching remote provider metadata", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/llm-models", {
      method: "POST",
      body: JSON.stringify({
        provider: "gemini",
      }),
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();

    const payload = await response.json();
    expect(payload.models).toEqual([
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    ]);
  });

  it("rejects unsupported providers", async () => {
    const response = await POST(new Request("http://localhost/api/llm-models", {
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
