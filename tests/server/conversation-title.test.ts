import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { generateConversationTitle } from "@/server/conversation-title";

const tokenMocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  extendModelList: vi.fn(),
  tokenConstructors: vi.fn(),
}));

vi.mock("token.js", () => ({
  TokenJS: class {
    chat = {
      completions: {
        create: tokenMocks.createCompletion,
      },
    };

    extendModelList = tokenMocks.extendModelList;

    constructor(options?: unknown) {
      tokenMocks.tokenConstructors(options);
    }
  },
}));

describe("conversation title generation", () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    tokenMocks.createCompletion.mockReset();
    tokenMocks.extendModelList.mockReset();
    tokenMocks.tokenConstructors.mockReset();
    await db.delete(settings);
  });

  it("uses the configured supervisor Gemini model instead of hardcoded OpenAI", async () => {
    await db.insert(settings).values([
      { key: "SUPERVISOR_LLM_PROVIDER", value: "gemini", updatedAt: new Date() },
      { key: "SUPERVISOR_LLM_MODEL", value: "gemini-3.1-pro-preview", updatedAt: new Date() },
      { key: "GEMINI_API_KEY", value: "gemini-key", updatedAt: new Date() },
    ]);
    tokenMocks.createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({ title: "Gemini Title" }),
                },
              },
            ],
          },
        },
      ],
    });

    const result = await generateConversationTitle("use gemini for this title");

    expect(result).toEqual({ title: "Gemini Title", error: null });
    expect(tokenMocks.tokenConstructors).toHaveBeenCalledWith({
      apiKey: "gemini-key",
      baseURL: undefined,
    });
    expect(tokenMocks.extendModelList).toHaveBeenCalledWith("gemini", "gemini-3.1-pro-preview", {
      streaming: true,
      json: true,
      toolCalls: true,
      images: true,
    });
    expect(tokenMocks.createCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "gemini",
        model: "gemini-3.1-pro-preview",
      }),
    );
  });
});
