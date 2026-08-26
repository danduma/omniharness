import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, settings } from "@/server/db/schema";
import { generateConversationTitle, queueConversationTitleGeneration } from "@/server/conversation-title";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

const titleMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  agentConstructors: vi.fn(),
}));

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    constructor(options?: unknown) {
      titleMocks.agentConstructors(options);
    }

    generate = titleMocks.generate;
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
    titleMocks.generate.mockReset();
    titleMocks.agentConstructors.mockReset();
    delete (process.env as Record<string, string | undefined>).MOCK_LLM;
    await db.delete(messages);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
    __resetNamedEventsForTests();
  });

  afterEach(() => {
    if (originalMockLlm === undefined) {
      delete (process.env as Record<string, string | undefined>).MOCK_LLM;
    } else {
      (process.env as Record<string, string | undefined>).MOCK_LLM = originalMockLlm;
    }
  });

  it("uses the configured supervisor model and grounds the title in the opening exchange", async () => {
    titleMocks.generate.mockResolvedValue({ object: { title: "Restore Conversation Titles" } });

    const result = await generateConversationTitle({
      userMessage: "Titles never load for new conversations.",
      assistantReply: "I traced the provider title sources and both are empty.",
    });

    expect(result).toEqual({ title: "Restore Conversation Titles", error: null });
    expect(titleMocks.agentConstructors).toHaveBeenCalledWith(expect.objectContaining({
      model: {
        id: "google/gemini-3.5-flash",
        apiKey: "gemini-key",
        url: undefined,
      },
    }));
    expect(titleMocks.generate).toHaveBeenCalledWith(
      expect.stringContaining("Titles never load for new conversations."),
      expect.objectContaining({ structuredOutput: expect.any(Object) }),
    );
    expect(titleMocks.generate).toHaveBeenCalledWith(
      expect.stringContaining("I traced the provider title sources and both are empty."),
      expect.any(Object),
    );
  });

  async function insertConversation(userMessage: string) {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(plans).values({
      id: planId,
      path: `vibes/ad-hoc/${planId}.md`,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: userMessage,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: userMessage,
      createdAt: now,
    });
    return runId;
  }

  it("surfaces model failure and persists a local fallback title", async () => {
    const runId = await insertConversation("Investigate missing title metadata from providers");
    titleMocks.generate.mockRejectedValue(new Error("model unavailable"));

    await queueConversationTitleGeneration({
      runId,
      workerId: `${runId}-worker-1`,
      workerType: "codex",
      assistantReply: "Neither provider title source produced a usable value.",
      streamCandidateStatus: "missing",
      transcriptCandidateStatus: "not_applicable",
    });

    const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    expect(run?.title).toBe("Investigate Missing Title Metadata From Providers");
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "error.surfaced",
        code: "conversation.title_generation_failed",
        runId,
        surface: "log",
      }),
    );
  });

  it("does not overwrite a newer title when the model response arrives late", async () => {
    const runId = await insertConversation("Fix title generation race");
    let resolveGeneration: (value: { object: { title: string } }) => void = () => {
      throw new Error("Title generation promise was not initialized.");
    };
    titleMocks.generate.mockImplementation(() => new Promise((resolve) => {
      resolveGeneration = resolve;
    }));

    const pending = queueConversationTitleGeneration({
      runId,
      workerId: `${runId}-worker-1`,
      workerType: "codex",
      assistantReply: "I found the missing provider title and am preparing a fallback.",
      streamCandidateStatus: "missing",
      transcriptCandidateStatus: "not_applicable",
    });
    await vi.waitFor(() => expect(titleMocks.generate).toHaveBeenCalledOnce());
    await db.update(runs).set({ title: "Manual title wins" }).where(eq(runs.id, runId));
    resolveGeneration({ object: { title: "Late generated title" } });
    await pending;

    const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    expect(run?.title).toBe("Manual title wins");
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).not.toContainEqual(
      expect.objectContaining({
        kind: "conversation.title_updated",
        runId,
        source: "harness_llm",
      }),
    );
  });
});
