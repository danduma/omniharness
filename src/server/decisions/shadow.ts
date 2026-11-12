import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppDataPath } from "@/server/app-root";
import { emitNamedEvent } from "@/server/events/named-events";
import { redactHandoffText } from "@/server/handoff/redaction";
import type { DecisionPointId } from "@/shared/decision-layer";
import { decisionService, type DecisionOutcome, type DecisionService } from "./service";
import type { DecisionQuestions, DecisionResult } from "./types";

/**
 * Comparison recording for the decision layer, plus the fire-and-forget
 * runner used by decision points that never block their caller.
 *
 * Every answered decision is recorded next to what the existing heuristic
 * did, whether or not the point was allowed to act on it, so agreement can be
 * measured continuously (rollout B1/B2).
 *
 * Guarantees of `runShadowDecision` for callers:
 *  - fire-and-forget: the caller never awaits or observes the result;
 *  - never throws into the caller;
 *  - sampled per key, so a busy worker does not issue a call per poll.
 */

export type ShadowDecisionLogRecord = {
  at: string;
  requestId: string;
  point: DecisionPointId;
  runId: string | null;
  workerId: string | null;
  heuristic: string;
  decided: string;
  agree: boolean;
  confidence: number | null;
  model: string;
  escalated: boolean;
  costUsd: number | null;
  sampledOut: number;
  /** True when an acting point changed behavior because of this answer. */
  acted: boolean;
};

export type InterpretedDecision = { decided: string; confidence: number | null };

export type ShadowDecisionArgs = {
  point: DecisionPointId;
  runId: string | null;
  workerId: string | null;
  /** The decision the existing code actually took, as a stable label. */
  heuristic: string;
  state: unknown;
  questions: DecisionQuestions;
  /** Map the decision-layer answer onto the same label space as `heuristic`. */
  interpret: (result: DecisionResult) => InterpretedDecision | null;
  /** Sampling key, e.g. `${runId}:${workerId}`. */
  sampleKey: string;
  /** Minimum gap between calls for this key. */
  minIntervalMs: number;
  /** Bypass sampling (e.g. the heuristic chose the rarer, more important outcome). */
  alwaysSample?: boolean;
  timeoutMs?: number;
  /**
   * Called only when the point is allowed to act (`shadow: false`). Returns
   * whether it changed behavior; the point owns its own guardrails.
   */
  act?: (decision: InterpretedDecision, requestId: string) => boolean;
};

export type ShadowDeps = {
  service?: Pick<DecisionService, "decide">;
  now?: () => number;
  appendLog?: (record: ShadowDecisionLogRecord) => Promise<void>;
};

const MAX_SAMPLE_KEYS = 2_000;
const DEFAULT_TIMEOUT_MS = 8_000;

const sampling = new Map<string, { lastAt: number; sampledOut: number }>();

export function shadowDecisionLogPath(date: Date) {
  return getAppDataPath("decision-log", `${date.toISOString().slice(0, 10)}.jsonl`);
}

async function appendShadowLog(record: ShadowDecisionLogRecord) {
  const file = shadowDecisionLogPath(new Date(record.at));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

/** Returns admitted=false when this call was sampled out (counted, not dropped silently). */
function admit(key: string, now: number, minIntervalMs: number, alwaysSample: boolean) {
  const entry = sampling.get(key);
  if (!alwaysSample && entry && now - entry.lastAt < minIntervalMs) {
    entry.sampledOut += 1;
    return { admitted: false, sampledOut: entry.sampledOut };
  }
  const sampledOut = entry?.sampledOut ?? 0;
  sampling.delete(key);
  sampling.set(key, { lastAt: now, sampledOut: 0 });
  if (sampling.size > MAX_SAMPLE_KEYS) {
    const oldest = sampling.keys().next().value;
    if (oldest !== undefined) sampling.delete(oldest);
  }
  return { admitted: true, sampledOut };
}

/** Sampling gate shared with points that await their decision inline. */
export function admitDecisionSample(key: string, now: number, minIntervalMs: number, alwaysSample = false) {
  return admit(key, now, minIntervalMs, alwaysSample);
}

/** Emit `decision.shadow_compared` and append the log line. Never throws. */
export async function recordDecisionComparison(
  args: Pick<ShadowDecisionArgs, "point" | "runId" | "workerId" | "heuristic">,
  outcome: Extract<DecisionOutcome, { status: "answered" }>,
  decision: InterpretedDecision,
  extra: { sampledOut: number; acted: boolean },
  deps: ShadowDeps = {},
) {
  const now = deps.now ?? (() => Date.now());
  const appendLog = deps.appendLog ?? appendShadowLog;
  const record: ShadowDecisionLogRecord = {
    at: new Date(now()).toISOString(),
    requestId: outcome.requestId,
    point: args.point,
    runId: args.runId,
    workerId: args.workerId,
    heuristic: args.heuristic,
    decided: decision.decided,
    agree: decision.decided === args.heuristic,
    confidence: decision.confidence,
    model: outcome.result.model,
    escalated: outcome.result.escalated,
    costUsd: outcome.result.costUsd,
    sampledOut: extra.sampledOut,
    acted: extra.acted,
  };
  emitNamedEvent({
    kind: "decision.shadow_compared",
    requestId: record.requestId,
    point: record.point,
    runId: record.runId,
    workerId: record.workerId,
    heuristic: record.heuristic,
    decided: record.decided,
    agree: record.agree,
    confidence: record.confidence,
    sampledOut: record.sampledOut,
  });
  try {
    await appendLog(record);
  } catch (error) {
    emitNamedEvent({
      kind: "decision.log_failed",
      point: args.point,
      reason: redactHandoffText(error instanceof Error ? error.message : String(error), 300),
    });
  }
}

/** Start a fire-and-forget decision; returns the in-flight promise for tests only. */
export function runShadowDecision(args: ShadowDecisionArgs, deps: ShadowDeps = {}): Promise<void> | null {
  const now = deps.now ?? (() => Date.now());
  const gate = admit(args.sampleKey, now(), args.minIntervalMs, Boolean(args.alwaysSample));
  if (!gate.admitted) return null;

  const service = deps.service ?? decisionService;

  return (async () => {
    let outcome: DecisionOutcome;
    try {
      outcome = await service.decide({
        point: args.point,
        runId: args.runId,
        workerId: args.workerId,
        state: args.state,
        questions: args.questions,
        timeoutMs: args.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
    } catch {
      // DecisionService is designed not to throw; if it ever does, this path
      // must still be invisible to the caller.
      return;
    }
    // Skipped and fallback outcomes already emitted their own events.
    if (outcome.status !== "answered") return;

    const decision = args.interpret(outcome.result);
    if (!decision) return;
    let acted = false;
    if (!outcome.shadow && args.act) {
      try {
        acted = args.act(decision, outcome.requestId);
      } catch {
        acted = false;
      }
    }
    await recordDecisionComparison(args, outcome, decision, { sampledOut: gate.sampledOut, acted }, deps);
  })();
}

export function __resetShadowSamplingForTests() {
  sampling.clear();
}
