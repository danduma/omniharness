import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/server/supervisor/runtime-settings", () => ({
  hydrateRuntimeEnvFromSettings: () => ({
    env: {
      SUPERVISOR_LLM_PROVIDER: "gemini",
      SUPERVISOR_LLM_MODEL: "gemini-3.5-flash",
      SUPERVISOR_LLM_API_KEY: "gemini-key",
      GEMINI_API_KEY: "gemini-key",
    },
    decryptionFailures: [],
  }),
}));

describe("conversation title generation", () => {
  const originalMockLlm = process.env.MOCK_LLM;

  beforeEach(async () => {
    vi.unstubAllEnvs();
    tokenMocks.generate.mockReset();
    tokenMocks.agentConstructors.mockReset();
    // The global test setup sets MOCK_LLM=true so unrelated suites
    // don't make real LLM calls. This file exercises the actual
    // Mastra integration (with a mocked Agent class), so we must opt
    // out of the bypass.
    delete (process.env as Record<string, string | undefined>).MOCK_LLM;
    await db.delete(settings);
  });

  afterEach(() => {
    if (originalMockLlm === undefined) {
      delete (process.env as Record<string, string | undefined>).MOCK_LLM;
    } else {
      (process.env as Record<string, string | undefined>).MOCK_LLM = originalMockLlm;
    }
  });

  it("uses the configured supervisor Gemini model through Mastra instead of hardcoded OpenAI", async () => {
    await db.insert(settings).values([
      { key: "SUPERVISOR_LLM_PROVIDER", value: "gemini", updatedAt: new Date() },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.5-flash", updatedAt: new Date() },
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
          id: "google/gemini-3.5-flash",
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
