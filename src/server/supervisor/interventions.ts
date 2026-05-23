import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { recordSupervisorInterventionArtifact } from "./intervention-store";

export function classifySupervisorIntervention(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (
    /\bnot fully implemented\b/.test(normalized)
    || /\bremaining (checklist|plan|task|item)/.test(normalized)
    || /\bfinish the remaining\b/.test(normalized)
    || /\bincomplete\b/.test(normalized)
  ) {
    return "completion_gap";
  }

  if (/\bstuck\b|\bwedged\b|\brecover\b|\bretry\b/.test(normalized)) {
    return "recovery";
  }

  return "continue";
}

export async function recordSupervisorIntervention(args: {
  runId: string;
  workerId: string;
  prompt: string;
  summary?: string | null;
  interventionType?: string | null;
}) {
  const interventionType = args.interventionType?.trim() || classifySupervisorIntervention(args.prompt);
  const summary = args.summary?.trim() || null;
  const createdAt = new Date();
  const { id } = await recordSupervisorInterventionArtifact({
    runId: args.runId,
    workerId: args.workerId,
    prompt: args.prompt,
    summary,
    interventionType,
    createdAt,
  });
  notifyEventStreamSubscribers();
  return {
    id,
    runId: args.runId,
    workerId: args.workerId,
    interventionType,
    prompt: args.prompt,
    summary,
    createdAt,
  };
}
