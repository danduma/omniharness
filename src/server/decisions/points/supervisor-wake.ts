import { emitNamedEvent } from "@/server/events/named-events";
import { decisionService, type DecisionOutcome, type DecisionService } from "../service";
import { recordDecisionComparison, runShadowDecision, type ShadowDecisionArgs, type ShadowDeps } from "../shadow";

/**
 * Decision point "supervisor_wake".
 *
 * Shadow (default): after an observer poll for one worker, ask whether the
 * supervisor needs to act and record it next to what the observer did.
 *
 * Acting (opt-in, rollout B2): `gateSupervisorWake` may *defer* a wake by
 * WAKE_DEFER_MS, never drop it. The observer marks idle and completion hints
 * as already notified, so a dropped wake might never be raised again; a
 * deferred wake goes through the durable wake schedule, which keeps the
 * earliest deadline, so any real event still wakes the supervisor at once.
 * Deferral happens only when every reason to wake is heuristic (idle
 * silence, a long final-looking text turn), only on a confident "no", and at
 * most WAKE_SUPPRESS_MAX_CONSECUTIVE times or WAKE_SUPPRESS_MAX_WINDOW_MS in
 * a row for a worker before the watchdog forces an immediate wake.
 */

export const SUPERVISOR_WAKE_MIN_INTERVAL_MS = 30_000;
/** A wake is deferred only when P(needs supervisor) is at or below this. */
export const WAKE_SUPPRESS_MAX_PROBABILITY = 0.2;
/** How long a deferred wake waits; an earlier scheduled wake always wins. */
export const WAKE_DEFER_MS = 2 * 60_000;
export const WAKE_SUPPRESS_MAX_CONSECUTIVE = 3;
export const WAKE_SUPPRESS_MAX_WINDOW_MS = 5 * 60_000;
/** The observer waits at most this long for an acting decision before waking anyway. */
export const WAKE_GATE_TIMEOUT_MS = 3_000;
const RECENT_OUTPUT_CHARS = 1_500;
const MAX_TRACKED_WORKERS = 2_000;

export type WakeEvent = {
  type: string;
  summary: string;
  shouldWakeSupervisor?: boolean;
  wakeCertainty?: "heuristic";
};

export type SupervisorWakeShadowInput = {
  runId: string;
  workerId: string;
  runStatus: string;
  workerState: string | null;
  stopReason: string | null;
  events: ReadonlyArray<WakeEvent>;
  recentOutput: string;
  /** Whether the observer called wakeSupervisor during this poll for this worker. */
  woke: boolean;
};

export function buildSupervisorWakeShadow(input: SupervisorWakeShadowInput): ShadowDecisionArgs {
  return {
    point: "supervisor_wake",
    runId: input.runId,
    workerId: input.workerId,
    heuristic: input.woke ? "wake" : "no_wake",
    state: {
      runStatus: input.runStatus,
      worker: { state: input.workerState, stopReason: input.stopReason },
      observedEvents: input.events.map((event) => ({ type: event.type, summary: event.summary })),
      recentOutput: input.recentOutput.slice(-RECENT_OUTPUT_CHARS),
    },
    questions: {
      needsSupervisor: {
        type: "boolean",
        instructions: "Does the supervising agent need to act now on this coding worker?",
        criteria: {
          true: "the worker finished a turn, asked a question, needs a permission decision, errored, stopped, or looks stuck",
          false: "the worker is still making progress on its task and needs nothing yet",
        },
      },
    },
    interpret: (result) => {
      const answer = result.answers.needsSupervisor;
      if (!answer || answer.type !== "boolean") return null;
      return {
        decided: answer.probability >= 0.5 ? "wake" : "no_wake",
        confidence: Math.abs(answer.probability - 0.5) * 2,
      };
    },
    sampleKey: `supervisor_wake:${input.runId}:${input.workerId}`,
    minIntervalMs: SUPERVISOR_WAKE_MIN_INTERVAL_MS,
    // Wakes are the rarer, costlier outcome; compare every one of them.
    alwaysSample: input.woke,
  };
}

export function shadowSupervisorWake(input: SupervisorWakeShadowInput) {
  if (input.events.length === 0) return null;
  return runShadowDecision(buildSupervisorWakeShadow(input));
}

/** True when the poll wants to wake the supervisor and every reason is heuristic. */
export function isSuppressibleWake(events: ReadonlyArray<WakeEvent>) {
  const wakeEvents = events.filter((event) => event.shouldWakeSupervisor);
  return wakeEvents.length > 0 && wakeEvents.every((event) => event.wakeCertainty === "heuristic");
}

const suppressions = new Map<string, { count: number; firstAt: number }>();

function suppressionKey(runId: string, workerId: string) {
  return `${runId}\u0000${workerId}`;
}

/** The supervisor was actually woken for this worker: the suppression streak ends. */
export function noteSupervisorWoken(runId: string, workerId: string) {
  suppressions.delete(suppressionKey(runId, workerId));
}

export type WakeGateResult = {
  /** 0 wakes now; > 0 schedules the same wake later (deferral). */
  delayMs: number;
  /** True when the decision layer was asked, so the caller must not also run the shadow call. */
  consulted: boolean;
};

const WAKE_NOW = (consulted: boolean): WakeGateResult => ({ delayMs: 0, consulted });

type GateDeps = ShadowDeps & { service?: Pick<DecisionService, "decide" | "pointMode"> };

/**
 * Decide whether a suppressible wake should still happen. Only awaits the
 * decision layer when this point is allowed to act; otherwise returns
 * immediately (wake, not consulted) and the caller records a shadow decision.
 */
export async function gateSupervisorWake(
  input: Omit<SupervisorWakeShadowInput, "woke">,
  deps: GateDeps = {},
): Promise<WakeGateResult> {
  const service = deps.service ?? decisionService;
  const now = deps.now ?? (() => Date.now());
  if (!isSuppressibleWake(input.events)) return WAKE_NOW(false);
  if ((await service.pointMode("supervisor_wake")) !== "acting") return WAKE_NOW(false);

  const key = suppressionKey(input.runId, input.workerId);
  const streak = suppressions.get(key);
  if (streak && (streak.count >= WAKE_SUPPRESS_MAX_CONSECUTIVE || now() - streak.firstAt >= WAKE_SUPPRESS_MAX_WINDOW_MS)) {
    suppressions.delete(key);
    emitNamedEvent({
      kind: "decision.overridden",
      point: "supervisor_wake",
      runId: input.runId,
      workerId: input.workerId,
      by: "watchdog",
      reason: streak.count >= WAKE_SUPPRESS_MAX_CONSECUTIVE
        ? `wake deferred ${streak.count} times in a row`
        : `wake deferred for ${Math.round((now() - streak.firstAt) / 1000)}s`,
    });
    return WAKE_NOW(false);
  }

  const shadow = buildSupervisorWakeShadow({ ...input, woke: true });
  let outcome: DecisionOutcome;
  try {
    outcome = await service.decide({
      point: "supervisor_wake",
      runId: input.runId,
      workerId: input.workerId,
      state: shadow.state,
      questions: shadow.questions,
      timeoutMs: WAKE_GATE_TIMEOUT_MS,
    });
  } catch {
    return WAKE_NOW(true);
  }
  if (outcome.status !== "answered") return WAKE_NOW(true);

  const decision = shadow.interpret(outcome.result);
  const answer = outcome.result.answers.needsSupervisor;
  const probability = answer && answer.type === "boolean" ? answer.probability : null;
  const suppress = !outcome.shadow
    && decision?.decided === "no_wake"
    && probability !== null
    && probability <= WAKE_SUPPRESS_MAX_PROBABILITY;

  if (decision) {
    void recordDecisionComparison(shadow, outcome, decision, { sampledOut: 0, acted: suppress }, deps);
  }
  if (!suppress) return WAKE_NOW(true);

  const next = streak ? { count: streak.count + 1, firstAt: streak.firstAt } : { count: 1, firstAt: now() };
  suppressions.delete(key);
  suppressions.set(key, next);
  if (suppressions.size > MAX_TRACKED_WORKERS) {
    const oldest = suppressions.keys().next().value;
    if (oldest !== undefined) suppressions.delete(oldest);
  }
  emitNamedEvent({
    kind: "decision.acted",
    requestId: outcome.requestId,
    point: "supervisor_wake",
    runId: input.runId,
    workerId: input.workerId,
    action: "deferred_wake",
    from: "wake",
    to: "no_wake",
    confidence: decision?.confidence ?? null,
  });
  return { delayMs: WAKE_DEFER_MS, consulted: true };
}

export function __resetWakeSuppressionsForTests() {
  suppressions.clear();
}
