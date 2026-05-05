import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { supervisorInterventions } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

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
  const record = {
    id: randomUUID(),
    runId: args.runId,
    workerId: args.workerId,
    interventionType: args.interventionType?.trim() || classifySupervisorIntervention(args.prompt),
    prompt: args.prompt,
    summary: args.summary?.trim() || null,
    createdAt: new Date(),
  };

  await db.insert(supervisorInterventions).values(record);
  notifyEventStreamSubscribers();
  return record;
}
