import { describe, expect, it, vi } from "vitest";
import { createVercelGatewayDecisionProvider, parseDecisionResponse } from "@/server/decisions/vercel-gateway-provider";
import { DecisionProviderError, type DecisionProviderCall, type DecisionQuestions } from "@/server/decisions/types";

// Placeholder only; never a real key.
const FAKE_KEY = "vck_TESTONLY_placeholder_0000";

const questions: DecisionQuestions = {
  wake: { type: "boolean", instructions: "Does the supervisor need to act?" },
  reason: { type: "choice", instructions: "Why?", criteria: { output: "new output", question: "worker asked something" } },
};

function call(overrides: Partial<DecisionProviderCall> = {}): DecisionProviderCall {
  return {
    model: "typesafe-ai/jev",
    escalationModel: null,
    zeroDataRetention: false,
    state: { summary: "worker printed a diff" },
    questions,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const okBody = {
  model: "typesafe-ai/jev",
  answers: {
    wake: { type: "boolean", probability: 0.12 },
    reason: { type: "choice", choice: "output", probabilities: { output: 0.9, question: 0.1 }, confidence: 0.85 },
  },
  usage: { inputTokens: 275, outputTokens: 20 },
  providerMetadata: { gateway: { cost: "0.00001155", routing: { modelAttempts: [] } } },
};

describe("Vercel AI Gateway decision provider", () => {
  it("posts the documented /v1/evaluate request with bearer auth", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    const provider = createVercelGatewayDecisionProvider({ apiKey: FAKE_KEY, fetchImpl });

    const result = await provider.decide(call());

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/evaluate");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${FAKE_KEY}`, "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ model: "typesafe-ai/jev", state: { summary: "worker printed a diff" }, questions });
    expect(result).toEqual({
      answers: okBody.answers,
      model: "typesafe-ai/jev",
      escalated: false,
      triggeredBy: [],
      usage: { inputTokens: 275, outputTokens: 20 },
      costUsd: 0.00001155,
    });
  });

  it("adds the decision-fallback and zero-data-retention gateway options only when configured", async () => {
    // A Response body can be read once, so build a fresh one per call.
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(200, okBody));
    const provider = createVercelGatewayDecisionProvider({ apiKey: FAKE_KEY, fetchImpl, baseUrl: "https://gateway.test/" });
    const when = { question: "reason", confidenceBelow: 0.6 };

    await provider.decide(call({ escalationModel: "openai/strong-model", zeroDataRetention: true, escalateWhen: when }));

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://gateway.test/v1/evaluate");
    expect(JSON.parse(init.body).providerOptions).toEqual({
      gateway: { zeroDataRetention: true, models: [{ model: "openai/strong-model", when }] },
    });

    // An escalation model without a condition must not send a conditional entry.
    await provider.decide(call({ escalationModel: "openai/strong-model" }));
    expect(JSON.parse(fetchImpl.mock.calls[1]![1].body).providerOptions).toBeUndefined();
  });

  it("reports escalation from routing metadata", () => {
    const result = parseDecisionResponse({
      ...okBody,
      model: "openai/strong-model",
      providerMetadata: {
        gateway: {
          cost: "0.002",
          routing: { modelAttempts: [{ success: true }, { success: true, triggeredBy: [{ question: "reason", reason: "confidence_below" }] }] },
        },
      },
    }, questions, "typesafe-ai/jev");
    expect(result.escalated).toBe(true);
    expect(result.model).toBe("openai/strong-model");
    expect(result.triggeredBy).toEqual([{ question: "reason", reason: "confidence_below" }]);
  });

  it.each([
    [401, "auth_failed"],
    [403, "auth_failed"],
    [402, "budget_exceeded"],
    [429, "rate_limited"],
    [500, "provider_error"],
  ] as const)("maps HTTP %i to %s without leaking the key", async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status, { error: { type: "x", message: "nope" } }, status === 429 ? { "retry-after": "7" } : {}));
    const provider = createVercelGatewayDecisionProvider({ apiKey: FAKE_KEY, fetchImpl });
    const error = await provider.decide(call()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DecisionProviderError);
    expect((error as DecisionProviderError).code).toBe(code);
    expect((error as DecisionProviderError).message).not.toContain(FAKE_KEY);
    if (status === 429) expect((error as DecisionProviderError).retryAfterSeconds).toBe(7);
  });

  it("maps an aborted request to timeout", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const provider = createVercelGatewayDecisionProvider({ apiKey: FAKE_KEY, fetchImpl });
    await expect(provider.decide(call({ signal: controller.signal }))).rejects.toMatchObject({ code: "timeout" });
  });

  it("rejects responses missing an answer or with the wrong answer type", () => {
    expect(() => parseDecisionResponse({ answers: { wake: { type: "boolean", probability: 0.2 } } }, questions, "m"))
      .toThrowError(/no valid choice answer for "reason"/);
    expect(() => parseDecisionResponse({ answers: { wake: { type: "score", score: 1 }, reason: okBody.answers.reason } }, questions, "m"))
      .toThrowError(/no valid boolean answer for "wake"/);
    expect(() => parseDecisionResponse({ answers: { wake: { type: "boolean", probability: "high" }, reason: okBody.answers.reason } }, questions, "m"))
      .toThrowError(DecisionProviderError);
  });

  it("accepts a refusal as an answer to any question", () => {
    const result = parseDecisionResponse({ answers: { wake: { type: "refusal" }, reason: okBody.answers.reason } }, questions, "m");
    expect(result.answers.wake).toEqual({ type: "refusal" });
  });
});
