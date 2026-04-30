import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import type { AgentRecord } from "@/server/bridge-client";
import { collectPlannerArtifacts } from "@/server/planning/artifacts";
import { derivePlanningStatus, type PlanningConversationStatus } from "@/server/planning/status";

function parseOutputEntriesJson(value: string | null | undefined) {
  if (!value?.trim()) {
    return [] as Array<{ text?: string }>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as Array<{ text?: string }> : [];
  } catch {
    return [] as Array<{ text?: string }>;
  }
}

function collectTextParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean);
}

export async function refreshPlanningArtifactsForRun(args: {
  run: typeof runs.$inferSelect;
  worker?: typeof workers.$inferSelect | null;
  snapshot?: AgentRecord | null;
  responseText?: string | null;
  status?: PlanningConversationStatus;
}) {
  const runMessages = await db.select().from(messages)
    .where(eq(messages.runId, args.run.id))
    .orderBy(asc(messages.createdAt));
  const worker = args.worker ?? await db.select().from(workers).where(eq(workers.runId, args.run.id)).get();
  const snapshot = args.snapshot ?? null;
  const cwd = snapshot?.cwd || worker?.cwd || args.run.projectPath || process.cwd();
  const persistedEntryText = parseOutputEntriesJson(worker?.outputEntriesJson)
    .map((entry) => entry.text)
    .filter((text): text is string => Boolean(text?.trim()));
  const liveEntryText = (snapshot?.outputEntries ?? [])
    .map((entry) => entry.text)
    .filter((text) => Boolean(text.trim()));
  const outputText = collectTextParts(
    ...runMessages.map((message) => message.content),
    worker?.outputLog,
    worker?.currentText,
    worker?.lastText,
    snapshot?.renderedOutput ?? undefined,
    snapshot?.currentText,
    snapshot?.lastText,
    ...persistedEntryText,
    ...liveEntryText,
    args.responseText ?? undefined,
  ).join("\n\n");

  const artifacts = await collectPlannerArtifacts({ cwd, outputText });
  const nextStatus = args.status ?? derivePlanningStatus({
    workerState: snapshot?.state ?? worker?.status,
    lastError: snapshot?.lastError ?? args.run.lastError,
    artifacts,
  });
  const now = new Date();

  await db.update(runs).set({
    status: nextStatus,
    failedAt: nextStatus === "failed" ? args.run.failedAt ?? now : args.run.failedAt,
    lastError: snapshot?.lastError || args.run.lastError,
    specPath: artifacts.specPath,
    artifactPlanPath: artifacts.planPath,
    plannerArtifactsJson: JSON.stringify(artifacts),
    updatedAt: now,
  }).where(eq(runs.id, args.run.id));

  return { artifacts, status: nextStatus };
}
