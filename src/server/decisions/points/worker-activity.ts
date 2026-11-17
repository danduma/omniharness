import { runShadowDecision, type ShadowDecisionArgs } from "../shadow";
import { emitNamedEvent } from "@/server/events/named-events";
import { classifyToolActivity } from "@/shared/agent-activity";

/**
 * Decision point "worker_activity": for a command the worker runs, compare
 * the deterministic test-command pattern (testing vs executing) with the
 * decision layer's classification.
 *
 * Shadow (default): record only.
 * Acting (opt-in): a confident disagreement re-labels the worker's current
 * activity, display only, and only while that command is still the worker's
 * current activity. Nothing else in OmniHarness reads this label.
 */

export const WORKER_ACTIVITY_MIN_INTERVAL_MS = 15_000;
/** Minimum decision-layer confidence before a disagreement re-labels the activity. */
export const WORKER_ACTIVITY_ACT_CONFIDENCE = 0.8;
const COMMAND_MAX_CHARS = 500;

export type CommandEntry = { type: string; text: string; toolKind?: string | null; seq?: number };

export type RefineActivity = (runId: string, workerId: string, entrySeq: number, activity: "testing" | "executing") => boolean;

export function buildWorkerActivityShadow(args: {
  runId: string;
  workerId: string;
  command: string;
  entrySeq?: number | null;
  refine?: RefineActivity;
}): ShadowDecisionArgs | null {
  const heuristic = classifyToolActivity({ kind: "execute", title: args.command });
  if (heuristic !== "testing" && heuristic !== "executing") return null;
  return {
    point: "worker_activity",
    runId: args.runId,
    workerId: args.workerId,
    heuristic,
    state: { command: args.command.slice(0, COMMAND_MAX_CHARS) },
    questions: {
      commandKind: {
        type: "choice",
        instructions: "What is this shell command a coding agent ran mainly doing?",
        criteria: {
          testing: "running automated tests or a test runner",
          executing: "anything else: building, installing, git, scripts, inspecting files",
        },
      },
    },
    interpret: (result) => {
      const answer = result.answers.commandKind;
      if (!answer || answer.type !== "choice") return null;
      if (answer.choice !== "testing" && answer.choice !== "executing") return null;
      return { decided: answer.choice, confidence: answer.confidence ?? null };
    },
    act: (decision, requestId) => {
      if (decision.decided === heuristic) return false;
      if ((decision.confidence ?? 0) < WORKER_ACTIVITY_ACT_CONFIDENCE) return false;
      if (!args.refine || typeof args.entrySeq !== "number") return false;
      const refined = args.refine(args.runId, args.workerId, args.entrySeq, decision.decided as "testing" | "executing");
      if (refined) {
        emitNamedEvent({
          kind: "decision.acted",
          requestId,
          point: "worker_activity",
          runId: args.runId,
          workerId: args.workerId,
          action: "refined_activity",
          from: heuristic,
          to: decision.decided,
          confidence: decision.confidence,
        });
      }
      return refined;
    },
    sampleKey: `worker_activity:${args.runId}:${args.workerId}`,
    minIntervalMs: WORKER_ACTIVITY_MIN_INTERVAL_MS,
  };
}

/** Classify the latest command in an append batch, if there is one. */
export function shadowWorkerActivity(
  runId: string,
  workerId: string,
  entries: ReadonlyArray<CommandEntry>,
  refine?: RefineActivity,
) {
  const latestCommand = [...entries].reverse().find((entry) => (
    entry.type === "tool_call" && (entry.toolKind ?? "").trim().toLowerCase() === "execute" && entry.text.trim()
  ));
  if (!latestCommand) return null;
  const shadow = buildWorkerActivityShadow({
    runId,
    workerId,
    command: latestCommand.text,
    entrySeq: latestCommand.seq ?? null,
    refine,
  });
  return shadow ? runShadowDecision(shadow) : null;
}
