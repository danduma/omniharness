import { normalizeWorkerType, type SupportedWorkerType } from "@/server/supervisor/worker-types";
import type { HandoffReport } from "./parser";
import { gatherHandoffCandidates } from "./candidates";

/**
 * Build a best-effort handoff report exclusively from persisted state.
 * The source worker is assumed unavailable and is never contacted.
 */
export async function buildPersistedHandoff(args: {
  runId: string;
  workerId: string;
  reason: string;
  originalPrompt: string;
}): Promise<HandoffReport> {
  const candidates = await gatherHandoffCandidates({ runId: args.runId, workerId: args.workerId });
  const workerType = normalizeWorkerType(candidates.worker?.type ?? "codex") as SupportedWorkerType;
  const progressSections = [
    candidates.recentUserMessages.length > 0
      ? `Recent user requests:\n${candidates.recentUserMessages.map((message) => `- ${message}`).join("\n")}`
      : null,
    candidates.recentAssistantSummary
      ? `Recent useful assistant context:\n${candidates.recentAssistantSummary}`
      : null,
    candidates.verification.length > 0
      ? `Recorded verification:\n${candidates.verification.map((record) => `- ${record.command}: ${record.result}${record.importantOutput ? ` — ${record.importantOutput}` : ""}`).join("\n")}`
      : null,
  ].filter((section): section is string => Boolean(section));

  return {
    task: candidates.currentObjective ?? candidates.originalRequest ?? (args.originalPrompt.slice(0, 280).trim() || "Continue the in-flight task."),
    progress: progressSections.join("\n\n").trim() || "No semantic worker output was available; inspect the persisted conversation and workspace.",
    nextSteps: "Continue from the persisted conversation and current workspace, verifying existing changes before editing.",
    blockers: candidates.workspace.warnings.length > 0 ? candidates.workspace.warnings.join("\n") : undefined,
    openQuestions: undefined,
    relevantFiles: candidates.workspace.modifiedFiles.map((file) => file.path),
    source: "synthetic",
    outgoingWorkerType: workerType,
    outgoingWorkerId: args.workerId,
    reason: args.reason,
  };
}
