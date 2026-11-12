import {
  DecisionProviderError,
  type DecisionAnswer,
  type DecisionProvider,
  type DecisionProviderCall,
  type DecisionQuestions,
  type DecisionResult,
  type TextGenerationCall,
  type TextGenerationResult,
} from "./types";

export const AI_GATEWAY_DEFAULT_BASE_URL = "https://ai-gateway.vercel.sh";

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Vercel AI Gateway decision endpoint (`POST /v1/evaluate`), called with plain
 * fetch so OmniHarness does not need AI SDK 7 just for `experimental_decide`.
 * Request and response shapes follow https://vercel.com/docs/ai-gateway/modalities/decision
 * and .../models-and-providers/decision-fallbacks (both read 2026-10-07).
 *
 * The API key is held in this closure only; it is never logged, persisted,
 * or included in thrown error messages.
 */
export function createVercelGatewayDecisionProvider(options: {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): DecisionProvider {
  const baseUrl = (options.baseUrl ?? AI_GATEWAY_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));

  const send = async (pathname: string, body: unknown, signal: AbortSignal) => {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${pathname}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal.aborted) {
        throw new DecisionProviderError("timeout", "Decision request timed out.");
      }
      throw new DecisionProviderError("provider_error", `Decision request failed: ${describeTransportError(error)}`);
    }
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    try {
      return await response.json() as unknown;
    } catch {
      throw new DecisionProviderError("invalid_response", "Decision response was not JSON.", response.status);
    }
  };

  return {
    id: "vercel-ai-gateway",
    async generateText(call: TextGenerationCall): Promise<TextGenerationResult> {
      // OpenAI-compatible Chat Completions on AI Gateway (/v1/chat/completions).
      const payload = await send("/v1/chat/completions", {
        model: call.model,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.prompt },
        ],
        max_tokens: call.maxTokens,
        ...(call.zeroDataRetention ? { providerOptions: { gateway: { zeroDataRetention: true } } } : {}),
      }, call.signal) as {
        model?: unknown;
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new DecisionProviderError("invalid_response", "Text response had no content.");
      }
      return {
        text: content,
        model: typeof payload.model === "string" && payload.model ? payload.model : call.model,
        usage: {
          inputTokens: finiteNumber(payload.usage?.prompt_tokens) ?? 0,
          outputTokens: finiteNumber(payload.usage?.completion_tokens) ?? 0,
        },
      };
    },
    async decide(call: DecisionProviderCall): Promise<DecisionResult> {
      const gateway: Record<string, unknown> = {};
      if (call.zeroDataRetention) gateway.zeroDataRetention = true;
      if (call.escalationModel && call.escalateWhen) {
        gateway.models = [{ model: call.escalationModel, when: call.escalateWhen }];
      }
      const body = {
        model: call.model,
        state: call.state,
        questions: call.questions,
        ...(Object.keys(gateway).length > 0 ? { providerOptions: { gateway } } : {}),
      };

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/evaluate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: call.signal,
        });
      } catch (error) {
        if (call.signal.aborted) {
          throw new DecisionProviderError("timeout", "Decision request timed out.");
        }
        throw new DecisionProviderError("provider_error", `Decision request failed: ${describeTransportError(error)}`);
      }

      if (!response.ok) {
        throw await errorFromResponse(response);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new DecisionProviderError("invalid_response", "Decision response was not JSON.", response.status);
      }
      return parseDecisionResponse(payload, call.questions, call.model);
    },
  };
}

function describeTransportError(error: unknown) {
  // Transport errors can echo the request URL but never headers; keep only the name.
  return error instanceof Error ? error.name : "unknown error";
}

async function errorFromResponse(response: Response): Promise<DecisionProviderError> {
  const status = response.status;
  const retryAfter = Number(response.headers.get("retry-after"));
  const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : null;
  // The body is provider-controlled; only a bounded error type/message is kept,
  // and the service redacts it again before surfacing.
  let detail = "";
  try {
    const parsed = (await response.json()) as { error?: { type?: unknown; message?: unknown } };
    const type = typeof parsed.error?.type === "string" ? parsed.error.type : "";
    const message = typeof parsed.error?.message === "string" ? parsed.error.message : "";
    detail = [type, message].filter(Boolean).join(": ").slice(0, 300);
  } catch {
    detail = "";
  }
  const suffix = detail ? ` (${detail})` : "";
  if (status === 401 || status === 403) {
    return new DecisionProviderError("auth_failed", `AI Gateway rejected the API key with HTTP ${status}${suffix}.`, status);
  }
  if (status === 402) {
    return new DecisionProviderError("budget_exceeded", `AI Gateway budget exceeded${suffix}.`, status);
  }
  if (status === 429) {
    return new DecisionProviderError("rate_limited", `AI Gateway rate limited the request${suffix}.`, status, retryAfterSeconds);
  }
  return new DecisionProviderError("provider_error", `AI Gateway returned HTTP ${status}${suffix}.`, status);
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => finiteNumber(entry) !== null);
  return Object.fromEntries(entries) as Record<string, number>;
}

function parseAnswer(raw: unknown): DecisionAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const answer = raw as Record<string, unknown>;
  switch (answer.type) {
    case "boolean": {
      const probability = finiteNumber(answer.probability);
      return probability === null ? null : { type: "boolean", probability };
    }
    case "choice": {
      if (typeof answer.choice !== "string") return null;
      const confidence = finiteNumber(answer.confidence);
      return {
        type: "choice",
        choice: answer.choice,
        probabilities: numberRecord(answer.probabilities),
        ...(confidence !== null ? { confidence } : {}),
      };
    }
    case "score": {
      const score = finiteNumber(answer.score);
      if (score === null) return null;
      const confidence = finiteNumber(answer.confidence);
      return {
        type: "score",
        score,
        probabilities: numberRecord(answer.probabilities),
        ...(confidence !== null ? { confidence } : {}),
      };
    }
    case "refusal":
      return { type: "refusal" };
    default:
      return null;
  }
}

export function parseDecisionResponse(payload: unknown, questions: DecisionQuestions, requestedModel: string): DecisionResult {
  if (!payload || typeof payload !== "object") {
    throw new DecisionProviderError("invalid_response", "Decision response was empty.");
  }
  const data = payload as {
    model?: unknown;
    answers?: unknown;
    usage?: { inputTokens?: unknown; outputTokens?: unknown };
    providerMetadata?: { gateway?: { cost?: unknown; routing?: { modelAttempts?: unknown } } };
  };
  const rawAnswers = data.answers && typeof data.answers === "object" ? data.answers as Record<string, unknown> : {};
  const answers: Record<string, DecisionAnswer> = {};
  for (const [id, question] of Object.entries(questions)) {
    const answer = parseAnswer(rawAnswers[id]);
    if (!answer || (answer.type !== "refusal" && answer.type !== question.type)) {
      throw new DecisionProviderError("invalid_response", `Decision response had no valid ${question.type} answer for "${id}".`);
    }
    answers[id] = answer;
  }

  const model = typeof data.model === "string" && data.model ? data.model : requestedModel;
  const attempts = Array.isArray(data.providerMetadata?.gateway?.routing?.modelAttempts)
    ? data.providerMetadata!.gateway!.routing!.modelAttempts as Array<{ triggeredBy?: unknown }>
    : [];
  const triggeredBy = attempts.flatMap((attempt) => (Array.isArray(attempt.triggeredBy) ? attempt.triggeredBy : []))
    .filter((entry): entry is { question: string; reason: string } => (
      !!entry && typeof entry === "object"
      && typeof (entry as { question?: unknown }).question === "string"
      && typeof (entry as { reason?: unknown }).reason === "string"
    ));
  const cost = Number.parseFloat(String(data.providerMetadata?.gateway?.cost ?? ""));

  return {
    answers,
    model,
    escalated: model !== requestedModel || triggeredBy.length > 0,
    triggeredBy,
    usage: {
      inputTokens: finiteNumber(data.usage?.inputTokens) ?? 0,
      outputTokens: finiteNumber(data.usage?.outputTokens) ?? 0,
    },
    costUsd: Number.isFinite(cost) ? cost : null,
  };
}
