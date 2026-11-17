import type { DecisionAnswer, DecisionProvider, DecisionProviderCall, DecisionResult, TextGenerationResult } from "./types";

/**
 * Deterministic provider for tests and `MOCK_LLM=true`: booleans answer 0.5,
 * choices pick the first option, scores pick the middle rung. Never escalates.
 */
export function createMockDecisionProvider(
  answerFor?: (questionId: string, call: DecisionProviderCall) => DecisionAnswer | undefined,
): DecisionProvider {
  return {
    id: "mock",
    async generateText(call): Promise<TextGenerationResult> {
      return { text: `Mock: ${call.prompt.split(/\s+/).slice(0, 4).join(" ")}`, model: call.model, usage: { inputTokens: 0, outputTokens: 0 } };
    },
    async decide(call): Promise<DecisionResult> {
      const answers: Record<string, DecisionAnswer> = {};
      for (const [id, question] of Object.entries(call.questions)) {
        const custom = answerFor?.(id, call);
        if (custom) {
          answers[id] = custom;
        } else if (question.type === "boolean") {
          answers[id] = { type: "boolean", probability: 0.5 };
        } else if (question.type === "choice") {
          answers[id] = { type: "choice", choice: Object.keys(question.criteria)[0] ?? "", confidence: 1 };
        } else {
          answers[id] = { type: "score", score: (question.criteria.length - 1) / 2, confidence: 1 };
        }
      }
      return {
        answers,
        model: call.model,
        escalated: false,
        triggeredBy: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
      };
    },
  };
}
