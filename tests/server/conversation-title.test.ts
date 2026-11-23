import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, settings } from "@/server/db/schema";
import { generateConversationTitle, queueConversationTitleGeneration } from "@/server/conversation-title";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

const codexMocks = vi.hoisted(() => ({
  readCodexCredentialsSync: vi.fn(() => null as null | { accessToken: string; accountId: string }),
  ensureFreshCodexCredentials: vi.fn(async () => ({ accessToken: "codex-token", accountId: "codex-account" })),
}));

vi.mock("@/server/auth/codex-auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/auth/codex-auth")>(),
  readCodexCredentialsSync: codexMocks.readCodexCredentialsSync,
  ensureFreshCodexCredentials: codexMocks.ensureFreshCodexCredentials,
}));

function codexTitleResponse(title: string) {
  const [first, ...rest] = title.split(" ");
  return new Response([
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: `${first} ` })}`,
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: rest.join(" ") })}`,
    'data: {"type":"response.completed"}',
  ].join("\n\n"));
}

describe("conversation title generation", () => {
  const originalMockLlm = process.env.MOCK_LLM;

  beforeEach(async () => {
    vi.unstubAllEnvs();
    codexMocks.readCodexCredentialsSync.mockReturnValue(null);
    delete (process.env as Record<string, string | undefined>).MOCK_LLM;
    await db.delete(messages);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
    __resetNamedEventsForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalMockLlm === undefined) {
      delete (process.env as Record<string, string | undefined>).MOCK_LLM;
    } else {
      (process.env as Record<string, string | undefined>).MOCK_LLM = originalMockLlm;
    }
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

  it("titles through the Codex subscription and grounds the title in the opening exchange", async () => {
    codexMocks.readCodexCredentialsSync.mockReturnValue({ accessToken: "codex-token", accountId: "codex-account" });
    const fetchMock = vi.fn(async () => codexTitleResponse("Restore Conversation Titles"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateConversationTitle({
      userMessage: "Titles never load for new conversations.",
      assistantReply: "I traced the provider title sources and both are empty.",
    });

    expect(result).toEqual({ title: "Restore Conversation Titles", error: null });
    const [, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({ store: false, stream: true });
    expect(JSON.stringify(body.input)).toContain("Titles never load for new conversations.");
    expect(JSON.stringify(body.input)).toContain("I traced the provider title sources and both are empty.");
    expect(new Headers(request.headers).get("chatgpt-account-id")).toBe("codex-account");
  });

  it("surfaces a missing Codex sign-in and persists a local fallback title", async () => {
    const runId = await insertConversation("Investigate missing title metadata from providers");

    await queueConversationTitleGeneration({
      runId,
      workerId: `${runId}-worker-1`,
      workerType: "codex",
      assistantReply: "Neither provider title source produced a usable value.",
      streamCandidateStatus: "missing",
      transcriptCandidateStatus: "not_applicable",
    });

    const run = await db.select({ title: runs.title, titleSource: runs.titleSource })
      .from(runs).where(eq(runs.id, runId)).get();
    expect(run).toEqual({ title: "Investigate Missing Title Metadata From Providers", titleSource: "harness_fallback" });
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "error.surfaced",
        code: "conversation.title_generation_failed",
        runId,
        surface: "log",
      }),
    );
  });

  it("persists the generated title as a harness title", async () => {
    const runId = await insertConversation("Investigate missing title metadata from providers");
    codexMocks.readCodexCredentialsSync.mockReturnValue({ accessToken: "codex-token", accountId: "codex-account" });
    vi.stubGlobal("fetch", vi.fn(async () => codexTitleResponse("Provider Title Recovery")));

    await queueConversationTitleGeneration({
      runId,
      workerId: `${runId}-worker-1`,
      workerType: "codex",
      assistantReply: "Neither provider title source produced a usable value.",
      streamCandidateStatus: "missing",
      transcriptCandidateStatus: "not_applicable",
    });

    const run = await db.select({ title: runs.title, titleSource: runs.titleSource })
      .from(runs).where(eq(runs.id, runId)).get();
    expect(run).toEqual({ title: "Provider Title Recovery", titleSource: "harness_llm" });
  });

  it("does not overwrite a newer title when the model response arrives late", async () => {
    const runId = await insertConversation("Fix title generation race");
    codexMocks.readCodexCredentialsSync.mockReturnValue({ accessToken: "codex-token", accountId: "codex-account" });
    let resolveResponse: (response: Response) => void = () => {
      throw new Error("Title response promise was not initialized.");
    };
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const pending = queueConversationTitleGeneration({
      runId,
      workerId: `${runId}-worker-1`,
      workerType: "codex",
      assistantReply: "I found the missing provider title and am preparing a fallback.",
      streamCandidateStatus: "missing",
      transcriptCandidateStatus: "not_applicable",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await db.update(runs).set({ title: "Manual title wins" }).where(eq(runs.id, runId));
    resolveResponse(codexTitleResponse("Late Generated Title"));
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
