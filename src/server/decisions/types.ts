import type { DecisionPointId } from "@/shared/decision-layer";

export type DecisionQuestion =
  | { type: "boolean"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type DecisionQuestions = Record<string, DecisionQuestion>;

export type DecisionAnswer =
  | { type: "boolean"; probability: number }
  | { type: "choice"; choice: string; probabilities?: Record<string, number>; confidence?: number }
  | { type: "score"; score: number; probabilities?: Record<string, number>; confidence?: number }
  | { type: "refusal" };

/**
 * AI Gateway decision-fallback condition (`providerOptions.gateway.models[0].when`).
 * Passed through as-is; the gateway validates it before running the primary model.
 */
export type DecisionEscalationCondition = Record<string, unknown>;

export type DecisionRequest = {
  point: DecisionPointId;
  runId?: string | null;
  workerId?: string | null;
  /** Already-minimal state. Strings are redacted again by the service before sending. */
  state: unknown;
  questions: DecisionQuestions;
  /** Escalate to the configured escalation model when this condition matches. */
  escalateWhen?: DecisionEscalationCondition;
  timeoutMs: number;
};

export type DecisionResult = {
  answers: Record<string, DecisionAnswer>;
  /** Model that produced the returned answers (the escalation model when it ran). */
  model: string;
  escalated: boolean;
  triggeredBy: Array<{ question: string; reason: string }>;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number | null;
};

export type DecisionProviderErrorCode =
  | "auth_failed"
  | "budget_exceeded"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "invalid_response";

export class DecisionProviderError extends Error {
  constructor(
    readonly code: DecisionProviderErrorCode,
    message: string,
    readonly status: number | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "DecisionProviderError";
  }
}

export type DecisionProviderCall = {
  model: string;
  escalationModel: string | null;
  zeroDataRetention: boolean;
  state: unknown;
  questions: DecisionQuestions;
  escalateWhen?: DecisionEscalationCondition;
  signal: AbortSignal;
};

export type TextGenerationCall = {
  model: string;
  zeroDataRetention: boolean;
  system: string;
  prompt: string;
  maxTokens: number;
  signal: AbortSignal;
};

export type TextGenerationResult = {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

export interface DecisionProvider {
  readonly id: "vercel-ai-gateway" | "mock";
  decide(call: DecisionProviderCall): Promise<DecisionResult>;
  /** Short text generation for the fast text lane (rollout B3). */
  generateText?(call: TextGenerationCall): Promise<TextGenerationResult>;
}
