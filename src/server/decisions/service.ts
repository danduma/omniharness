import { createHash, randomUUID } from "node:crypto";
import {
  emitNamedEvent,
  type DecisionFallbackReason,
  type DecisionSkipReason,
} from "@/server/events/named-events";
import { redactHandoffText } from "@/server/handoff/redaction";
import type { DecisionPointId, DecisionTarget, DecisionTextTaskId } from "@/shared/decision-layer";
import { loadDecisionLayerConfig, type DecisionLayerConfig } from "./config";
import { createMockDecisionProvider } from "./mock-provider";
import { DecisionProviderError, type DecisionProvider, type DecisionRequest, type DecisionResult } from "./types";
import { createVercelGatewayDecisionProvider } from "./vercel-gateway-provider";

/** Serialized-state ceiling: well under Jev's 32K-token context. */
export const DECISION_STATE_MAX_CHARS = 48_000;
const STATE_STRING_MAX_CHARS = 20_000;

export type TextOutcome =
  | { status: "answered"; requestId: string; text: string; model: string }
  | { status: "fallback"; requestId: string; reason: DecisionFallbackReason }
  | { status: "skipped"; reason: DecisionSkipReason };

export type TextRequest = {
  task: DecisionTextTaskId;
  runId?: string | null;
  system: string;
  /** Redacted again by the service before it leaves the process. */
  prompt: string;
  maxTokens: number;
  timeoutMs: number;
};

const TEXT_PROMPT_MAX_CHARS = 16_000;

export type DecisionOutcome =
  | { status: "answered"; requestId: string; shadow: boolean; result: DecisionResult }
  | { status: "fallback"; requestId: string; reason: DecisionFallbackReason }
  | { status: "skipped"; reason: DecisionSkipReason };

type ServiceOptions = {
  loadConfig?: () => Promise<DecisionLayerConfig>;
  createProvider?: (config: DecisionLayerConfig) => DecisionProvider;
  now?: () => number;
  env?: Record<string, string | undefined>;
};

function keyFingerprint(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

/** Recursively redact secrets and machine paths from every string in the state. */
export function redactDecisionState(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactHandoffText(value, STATE_STRING_MAX_CHARS);
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => redactDecisionState(entry, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactDecisionState(entry, depth + 1)]));
}

/**
 * Single entry point for every decision-layer call. Callers ask a typed
 * question and get answered / fallback / skipped back. On anything other
 * than "answered" (and, in shadow mode, even then) they keep their existing
 * behavior. Guardrails live here, not at call sites:
 *  - kill switch, per-point enablement, missing key;
 *  - an auth failure blocks further calls with that same key until it changes;
 *  - state is redacted and size-capped before it leaves the process;
 *  - every outcome is a named event, and errors that need the user are surfaced once.
 */
export class DecisionService {
  private readonly loadConfig: () => Promise<DecisionLayerConfig>;
  private readonly createProvider: (config: DecisionLayerConfig) => DecisionProvider;
  private readonly now: () => number;
  private readonly env: Record<string, string | undefined>;
  private readonly lastSkipReason = new Map<DecisionTarget, DecisionSkipReason | null>();
  private authBlockedFingerprint: string | null = null;
  private budgetSurfacedFingerprint: string | null = null;

  constructor(options: ServiceOptions = {}) {
    const env = options.env ?? process.env;
    this.env = env;
    this.loadConfig = options.loadConfig ?? (() => loadDecisionLayerConfig(env));
    this.createProvider = options.createProvider ?? ((config) => (
      env.MOCK_LLM === "true"
        ? createMockDecisionProvider()
        : createVercelGatewayDecisionProvider({ apiKey: config.apiKey!, baseUrl: config.baseUrl ?? undefined })
    ));
    this.now = options.now ?? (() => Date.now());
  }

  async decide(request: DecisionRequest, signal?: AbortSignal): Promise<DecisionOutcome> {
    let config: DecisionLayerConfig;
    try {
      config = await this.loadConfig();
    } catch {
      // Callers must always be able to fall back; an unreadable config is a skip.
      this.noteSkip(request.point, "config_error");
      return { status: "skipped", reason: "config_error" };
    }
    const skip = this.skipReason(config, request.point);
    if (skip) {
      this.noteSkip(request.point, skip);
      return { status: "skipped", reason: skip };
    }
    this.lastSkipReason.set(request.point, null);

    const requestId = randomUUID();
    const runId = request.runId ?? null;
    const shadow = !config.actingPoints.has(request.point);
    emitNamedEvent({
      kind: "decision.requested",
      requestId,
      point: request.point,
      runId,
      workerId: request.workerId ?? null,
      shadow,
    });

    const startedAt = this.now();
    const fallback = (reason: DecisionFallbackReason): DecisionOutcome => {
      emitNamedEvent({
        kind: "decision.fallback",
        requestId,
        point: request.point,
        runId,
        reason,
        latencyMs: Math.max(0, this.now() - startedAt),
      });
      return { status: "fallback", requestId, reason };
    };

    const state = redactDecisionState(request.state);
    if (JSON.stringify(state ?? null).length > DECISION_STATE_MAX_CHARS) {
      return fallback("state_too_large");
    }

    const timeout = AbortSignal.timeout(Math.max(1, request.timeoutMs));
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const result = await this.createProvider(config).decide({
        model: config.model,
        escalationModel: config.escalationModel,
        zeroDataRetention: config.zeroDataRetention,
        state,
        questions: request.questions,
        escalateWhen: request.escalateWhen,
        signal: combined,
      });
      emitNamedEvent({
        kind: "decision.answered",
        requestId,
        point: request.point,
        runId,
        model: result.model,
        escalated: result.escalated,
        latencyMs: Math.max(0, this.now() - startedAt),
        costUsd: result.costUsd,
        shadow,
      });
      return { status: "answered", requestId, shadow, result };
    } catch (error) {
      const providerError = error instanceof DecisionProviderError
        ? error
        : new DecisionProviderError(combined.aborted ? "timeout" : "provider_error", error instanceof Error ? error.name : "Decision failed.");
      this.surfaceIfNeeded(providerError, config, runId);
      return fallback(providerError.code);
    }
  }

  /**
   * Fast text lane (rollout B3): a short generation for a text task, with the
   * same guardrails as decisions (kill switch, per-task enablement, missing
   * key or model, auth blocking, redaction, timeout). Callers keep their
   * existing path on anything but "answered". Never throws.
   */
  async generateText(request: TextRequest, signal?: AbortSignal): Promise<TextOutcome> {
    let config: DecisionLayerConfig;
    try {
      config = await this.loadConfig();
    } catch {
      this.noteSkip(request.task, "config_error");
      return { status: "skipped", reason: "config_error" };
    }
    const skip = !config.enabled
      ? "disabled"
      : !config.textTasks.has(request.task)
        ? "point_disabled"
        : !config.textModel || (!config.apiKey && !this.usesMockProvider())
          ? "unconfigured"
          : config.apiKey && this.authBlockedFingerprint === keyFingerprint(config.apiKey)
            ? "auth_blocked"
            : null;
    if (skip) {
      this.noteSkip(request.task, skip);
      return { status: "skipped", reason: skip };
    }
    this.lastSkipReason.set(request.task, null);

    const requestId = randomUUID();
    const runId = request.runId ?? null;
    emitNamedEvent({ kind: "decision.requested", requestId, point: request.task, runId, workerId: null, shadow: false });
    const startedAt = this.now();
    const fallback = (reason: DecisionFallbackReason): TextOutcome => {
      emitNamedEvent({ kind: "decision.fallback", requestId, point: request.task, runId, reason, latencyMs: Math.max(0, this.now() - startedAt) });
      return { status: "fallback", requestId, reason };
    };

    const provider = this.createProvider(config);
    if (!provider.generateText) return fallback("provider_error");
    const timeout = AbortSignal.timeout(Math.max(1, request.timeoutMs));
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const result = await provider.generateText({
        model: config.textModel!,
        zeroDataRetention: config.zeroDataRetention,
        system: request.system,
        prompt: redactHandoffText(request.prompt, TEXT_PROMPT_MAX_CHARS),
        maxTokens: request.maxTokens,
        signal: combined,
      });
      emitNamedEvent({
        kind: "decision.answered",
        requestId,
        point: request.task,
        runId,
        model: result.model,
        escalated: false,
        latencyMs: Math.max(0, this.now() - startedAt),
        costUsd: null,
        shadow: false,
      });
      return { status: "answered", requestId, text: result.text, model: result.model };
    } catch (error) {
      const providerError = error instanceof DecisionProviderError
        ? error
        : new DecisionProviderError(combined.aborted ? "timeout" : "provider_error", error instanceof Error ? error.name : "Text generation failed.");
      this.surfaceIfNeeded(providerError, config, runId);
      return fallback(providerError.code);
    }
  }

  /**
   * Whether a point would be answered at all, and whether it may act. Lets a
   * caller avoid awaiting a decision it could only record. Never throws.
   */
  async pointMode(point: DecisionPointId): Promise<"off" | "shadow" | "acting"> {
    let config: DecisionLayerConfig;
    try {
      config = await this.loadConfig();
    } catch {
      return "off";
    }
    if (this.skipReason(config, point)) return "off";
    return config.actingPoints.has(point) ? "acting" : "shadow";
  }

  private skipReason(config: DecisionLayerConfig, point: DecisionPointId): DecisionSkipReason | null {
    if (!config.enabled) return "disabled";
    if (!config.points.has(point)) return "point_disabled";
    if (!config.apiKey && !this.usesMockProvider()) return "unconfigured";
    if (config.apiKey && this.authBlockedFingerprint === keyFingerprint(config.apiKey)) return "auth_blocked";
    return null;
  }

  private usesMockProvider() {
    return this.env.MOCK_LLM === "true";
  }

  private noteSkip(point: DecisionTarget, reason: DecisionSkipReason) {
    if (this.lastSkipReason.get(point) === reason) return;
    this.lastSkipReason.set(point, reason);
    emitNamedEvent({ kind: "decision.skipped", point, reason });
  }

  private surfaceIfNeeded(error: DecisionProviderError, config: DecisionLayerConfig, runId: string | null) {
    const fingerprint = config.apiKey ? keyFingerprint(config.apiKey) : null;
    if (error.code === "auth_failed") {
      // Stop calling with a key the gateway rejected; a new key unblocks.
      this.authBlockedFingerprint = fingerprint;
      emitNamedEvent({
        kind: "error.surfaced",
        code: "decision.auth_failed",
        message: redactHandoffText(`Decision layer disabled: ${error.message} Update AI_GATEWAY_API_KEY on the server.`, 600),
        surface: "banner",
        ...(runId ? { runId } : {}),
      });
      return;
    }
    if (error.code === "budget_exceeded" && this.budgetSurfacedFingerprint !== fingerprint) {
      this.budgetSurfacedFingerprint = fingerprint;
      emitNamedEvent({
        kind: "error.surfaced",
        code: "decision.budget_exceeded",
        message: redactHandoffText(`${error.message} Decisions fall back to the existing behavior until the budget resets.`, 600),
        surface: "toast",
        ...(runId ? { runId } : {}),
      });
    }
  }
}

export const decisionService = new DecisionService();
