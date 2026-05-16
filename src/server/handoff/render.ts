import { WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";
import type { HandoffReport } from "./parser";

/**
 * Render a HandoffReport into a markdown seed prompt for the replacement
 * worker. The receiving worker sees the original task, the outgoing
 * worker's progress, and what to do next.
 */
export function renderHandoffSeed(args: {
  report: HandoffReport;
  originalPrompt: string;
}): string {
  const lines: string[] = [];
  const outgoingLabel = WORKER_TYPE_LABELS[args.report.outgoingWorkerType] ?? args.report.outgoingWorkerType;

  lines.push(`# Failover Handoff`);
  lines.push("");
  lines.push(
    `You are taking over an in-flight task from a previous worker (${outgoingLabel}, id ${args.report.outgoingWorkerId}). ` +
    `The previous worker was stopped because: ${args.report.reason}.`,
  );
  lines.push("");
  lines.push(`The handoff report below was ${args.report.source === "worker" ? "produced by the previous worker" : "reconstructed automatically because the previous worker could not produce one"}. Treat it as advisory context, not a literal command — re-verify state on disk before acting.`);
  lines.push("");
  lines.push(`## Original task`);
  lines.push("");
  lines.push(args.originalPrompt.trim());
  lines.push("");
  lines.push(`## Handoff report`);
  lines.push("");
  lines.push(`**TASK:** ${args.report.task}`);
  lines.push("");
  lines.push(`**PROGRESS:** ${args.report.progress}`);
  lines.push("");
  lines.push(`**NEXT_STEPS:** ${args.report.nextSteps}`);
  if (args.report.blockers) {
    lines.push("");
    lines.push(`**BLOCKERS:** ${args.report.blockers}`);
  }
  if (args.report.openQuestions) {
    lines.push("");
    lines.push(`**OPEN_QUESTIONS:** ${args.report.openQuestions}`);
  }
  if (args.report.relevantFiles && args.report.relevantFiles.length > 0) {
    lines.push("");
    lines.push(`**RELEVANT_FILES:**`);
    for (const file of args.report.relevantFiles) {
      lines.push(`- ${file}`);
    }
  }
  lines.push("");
  lines.push(`Please continue from where the previous worker left off.`);
  return lines.join("\n");
}

export const HANDOFF_REQUEST_PROMPT = (
  "Your runtime has reported a quota exhaustion and you will be replaced by another agent. " +
  "Stop work immediately. Reply with exactly one fenced block:\n\n" +
  "```omniharness-handoff\n" +
  "TASK: <one sentence describing what you were doing>\n" +
  "PROGRESS: <what you have done — files touched, commits, test status>\n" +
  "NEXT_STEPS: <what should be done next>\n" +
  "BLOCKERS: <known blockers, or \"none\">\n" +
  "OPEN_QUESTIONS: <questions for the next worker, or \"none\">\n" +
  "RELEVANT_FILES: <comma-separated list of files the next worker should read first>\n" +
  "```\n\n" +
  "Be terse and factual. Do not start new work."
);
