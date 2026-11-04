import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { messages, plans, runs, settings } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { decisionConfigFromValues, type DecisionLayerConfig } from "@/server/decisions/config";
import { DecisionService } from "@/server/decisions/service";
import { createVercelGatewayDecisionProvider } from "@/server/decisions/vercel-gateway-provider";
import { DecisionProviderError, type DecisionProvider } from "@/server/decisions/types";
import { DECISION_SETTING_KEYS } from "@/shared/decision-layer";
import { cleanTextLaneTitle, generateConversationTitle } from "@/server/conversation-title";

const FAKE_KEY = "vck_TESTONLY_placeholder_0000";

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

function config(overrides: Partial<DecisionLayerConfig> = {}): DecisionLayerConfig {
  return {
    enabled: true,
    model: "typesafe-ai/jev",
    escalationModel: null,
    zeroDataRetention: false,
    points: new Set(),
    actingPoints: new Set(),
    textModel: "provider/small-model",
    textTasks: new Set(["conversation_title"]),
    apiKey: FAKE_KEY,
    baseUrl: null,
    ...overrides,
  };
}

const textRequest = { task: "conversation_title" as const, runId: "run-1", system: "Write a title.", prompt: "User asked to add caching", maxTokens: 32, timeoutMs: 1_000 };

function textProvider(generateText: DecisionProvider["generateText"]): DecisionProvider {
  return { id: "vercel-ai-gateway", decide: vi.fn(), generateText };
}

beforeEach(() => {
  __resetNamedEventsForTests();
});

describe("gateway chat completions", () => {
  it("posts an OpenAI-compatible chat request and reads the first choice", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      model: "provider/small-model",
      choices: [{ message: { content: "Add Request Caching" } }],
      usage: { prompt_tokens: 40, completion_tokens: 4 },
    }), { status: 200 }));
    const provider = createVercelGatewayDecisionProvider({ apiKey: FAKE_KEY, fetchImpl });
    const result = await provider.generateText!({ model: "provider/small-model", zeroDataRetention: true, system: "sys", prompt: "user", maxTokens: 32, signal: new AbortController().signal });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
    expect(JSON.parse(init.body)).toEqual({
      model: "provider/small-model",
      messages: [{ role: "system", content: "sys" }, { role: "user", content: "user" }],
      max_tokens: 32,
      providerOptions: { gateway: { zeroDataRetention: true } },
    });
    expect(result).toEqual({ text: "Add Request Caching", model: "provider/small-model", usage: { inputTokens: 40, outputTokens: 4 } });
  });

  it("rejects an empty completion", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 }));
    const provider = createVercelGatewayDecisionProvider({ apiKey: FAKE_KEY, fetchImpl });
    await expect(provider.generateText!({ model: "m", zeroDataRetention: false, system: "s", prompt: "p", maxTokens: 8, signal: new AbortController().signal }))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("DecisionService.generateText", () => {
  it("is off without a text model or task, and reports it once", async () => {
    const svc = new DecisionService({ loadConfig: async () => config({ textModel: null }), env: {} });
    expect(await svc.generateText(textRequest)).toEqual({ status: "skipped", reason: "unconfigured" });
    expect(await svc.generateText(textRequest)).toEqual({ status: "skipped", reason: "unconfigured" });
    const noTask = new DecisionService({ loadConfig: async () => config({ textTasks: new Set() }), env: {} });
    expect(await noTask.generateText(textRequest)).toEqual({ status: "skipped", reason: "point_disabled" });
    expect(events().filter((event) => event.kind === "decision.skipped")).toEqual([
      { kind: "decision.skipped", point: "conversation_title", reason: "unconfigured" },
      { kind: "decision.skipped", point: "conversation_title", reason: "point_disabled" },
    ]);
  });

  it("redacts the prompt, answers, and emits text-task events", async () => {
    const generateText = vi.fn().mockResolvedValue({ text: "Add Caching", model: "provider/small-model", usage: { inputTokens: 1, outputTokens: 1 } });
    const svc = new DecisionService({ loadConfig: async () => config(), createProvider: () => textProvider(generateText), env: {} });
    const outcome = await svc.generateText({ ...textRequest, prompt: "deploy with AI_GATEWAY_API_KEY=vck_TESTONLY_secret_value from /Users/someone/app" });
    expect(outcome).toMatchObject({ status: "answered", text: "Add Caching", model: "provider/small-model" });
    const sent = generateText.mock.calls[0]![0].prompt as string;
    expect(sent).not.toContain("vck_TESTONLY_secret_value");
    expect(sent).not.toContain("/Users/someone");
    expect(events().map((event) => event.kind)).toEqual(["decision.requested", "decision.answered"]);
    expect(events()[1]).toMatchObject({ point: "conversation_title", shadow: false });
  });

  it("falls back on provider errors and blocks a rejected key", async () => {
    const generateText = vi.fn().mockRejectedValue(new DecisionProviderError("auth_failed", "rejected", 401));
    const svc = new DecisionService({ loadConfig: async () => config(), createProvider: () => textProvider(generateText), env: {} });
    expect(await svc.generateText(textRequest)).toMatchObject({ status: "fallback", reason: "auth_failed" });
    expect(await svc.generateText(textRequest)).toEqual({ status: "skipped", reason: "auth_blocked" });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("reads the text model and tasks from settings", () => {
    const parsed = decisionConfigFromValues({
      [DECISION_SETTING_KEYS.textModel]: " provider/small-model ",
      [DECISION_SETTING_KEYS.textTasks]: JSON.stringify(["conversation_title", "nope"]),
    }, {});
    expect(parsed.textModel).toBe("provider/small-model");
    expect([...parsed.textTasks]).toEqual(["conversation_title"]);
    expect(decisionConfigFromValues({}, {}).textModel).toBeNull();
  });
});

describe("cleanTextLaneTitle", () => {
  it("keeps the first line without quotes, labels or markdown", () => {
    expect(cleanTextLaneTitle("Title: \"Add Request Caching\"\nExplanation...")).toBe("Add Request Caching");
    expect(cleanTextLaneTitle("\n\n## **Fix Login   Flow**")).toBe("Fix Login Flow");
    expect(cleanTextLaneTitle("   ")).toBe("");
  });
});

describe("conversation titles through the text lane", () => {
  const previousMock = process.env.MOCK_LLM;
  let runId: string;

  beforeEach(async () => {
    delete process.env.MOCK_LLM;
    await db.delete(settings);
    const planId = randomUUID();
    runId = randomUUID();
    const now = new Date();
    await db.insert(plans).values({ id: planId, path: "vibes/ad-hoc/plan.md", status: "running", createdAt: now, updatedAt: now });
    await db.insert(runs).values({ id: runId, planId, mode: "direct", status: "running", createdAt: now, updatedAt: now });
    await db.insert(messages).values({ id: randomUUID(), runId, role: "user", content: "please add caching to the api client", createdAt: now });
    await db.insert(settings).values([
      { key: DECISION_SETTING_KEYS.enabled, value: "true", updatedAt: now },
      { key: DECISION_SETTING_KEYS.textModel, value: "provider/small-model", updatedAt: now },
      { key: DECISION_SETTING_KEYS.textTasks, value: JSON.stringify(["conversation_title"]), updatedAt: now },
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (previousMock === undefined) delete process.env.MOCK_LLM;
    else process.env.MOCK_LLM = previousMock;
    delete process.env.AI_GATEWAY_API_KEY;
    await db.delete(settings);
  });

  function stubGateway(content: string) {
    process.env.AI_GATEWAY_API_KEY = FAKE_KEY;
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("uses the fast model's title when it passes the checks", async () => {
    const fetchMock = stubGateway("\"Add API Client Caching\"");
    const result = await generateConversationTitle({ runId, userMessage: "please add caching to the api client", assistantReply: "Added an LRU cache." });
    expect(result).toEqual({ title: "Add API Client Caching", error: null });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
  });

  it("rejects an echo of the user's prompt and reports it", async () => {
    stubGateway("please add caching to the api client");
    // The fast lane is rejected; the existing supervisor path then runs, so
    // only assert the rejection here, not the final title.
    await generateConversationTitle({ runId, userMessage: "please add caching to the api client", assistantReply: "Added an LRU cache." });
    expect(events()).toContainEqual(expect.objectContaining({ kind: "conversation.title_rejected", runId, source: "decision_text_lane", reason: "prompt_echo" }));
  });
});
