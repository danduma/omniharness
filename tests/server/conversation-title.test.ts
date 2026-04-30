import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { generateConversationTitle } from "@/server/conversation-title";

const tokenMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  agentConstructors: vi.fn(),
}));

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    constructor(options?: unknown) {
      tokenMocks.agentConstructors(options);
    }

    generate = tokenMocks.generate;
  },
}));

describe("conversation title generation", () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    tokenMocks.generate.mockReset();
    tokenMocks.agentConstructors.mockReset();
    await db.delete(settings);
  });

  it("uses the configured supervisor Gemini model through Mastra instead of hardcoded OpenAI", async () => {
    await db.insert(settings).values([
      { key: "SUPERVISOR_LLM_PROVIDER", value: "gemini", updatedAt: new Date() },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.1-pro-preview", updatedAt: new Date() },
      { key: "GEMINI_API_KEY", value: "gemini-key", updatedAt: new Date() },
    ]);
    tokenMocks.generate.mockResolvedValue({
      object: { title: "Gemini Title" },
    });

    const result = await generateConversationTitle("use gemini for this title");

    expect(result).toEqual({ title: "Gemini Title", error: null });
    expect(tokenMocks.agentConstructors).toHaveBeenCalledWith(
      expect.objectContaining({
        model: {
          id: "google/gemini-3.1-pro-preview",
          apiKey: "gemini-key",
          url: undefined,
        },
      }),
    );
    expect(tokenMocks.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ structuredOutput: expect.any(Object) }),
    );
  });
});
