import { and, asc, eq } from "drizzle-orm";
import fs from "fs";
import { db } from "@/server/db";
import { messages, planningReviewRuns, runs, workers } from "@/server/db/schema";
import type { AgentRecord } from "@/server/bridge-client";
import { collectPlannerArtifacts, type PlannerArtifactCandidate, type PlannerArtifacts } from "@/server/planning/artifacts";
import { derivePlanningStatus, type PlanningConversationStatus } from "@/server/planning/status";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import {
  ensureReadinessVerdict,
  hashPlanMarkdown,
  loadCachedReadinessRecord,
  type PlanReadinessRecord,
} from "@/server/plans/readiness-pipeline";
import { emitNamedEvent } from "@/server/events/named-events";

function collectTextParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean);
}

function isPlannerMessageEntry(entry: { type?: string; text?: string }) {
  return entry.type === "message" && Boolean(entry.text?.trim());
}

function isAgentBusyError(error: string | null | undefined) {
  return /\bagent is busy\b/i.test(error ?? "");
}

const WORKER_BUSY_STATES = new Set(["working", "starting"]);

async function hasActiveReviewRun(runId: string): Promise<boolean> {
  const active = await db.select({ id: planningReviewRuns.id })
    .from(planningReviewRuns)
    .where(and(
      eq(planningReviewRuns.runId, runId),
      eq(planningReviewRuns.status, "running"),
    ))
    .limit(1);
  return active.length > 0;
}

function readPlanMarkdown(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

async function attachReadinessRecordsToCandidates(args: {
  runId: string;
  workerBusy: boolean;
  artifacts: PlannerArtifacts;
}): Promise<{
  candidates: PlannerArtifactCandidate[];
  selectedRecord: PlanReadinessRecord | null;
}> {
  const specMarkdown = readPlanMarkdown(args.artifacts.specPath);
  let selectedRecord: PlanReadinessRecord | null = null;

  const enriched = await Promise.all(args.artifacts.candidates.map(async (candidate) => {
    if (candidate.kind !== "plan" || !candidate.exists) {
      return candidate;
    }

    const planMarkdown = readPlanMarkdown(candidate.path);
    if (!planMarkdown) {
      return candidate;
    }

    const cached = await loadCachedReadinessRecord({
      runId: args.runId,
      planPath: candidate.path,
      planHash: hashPlanMarkdown(planMarkdown),
    });

    const isSelected = candidate.path === args.artifacts.planPath;
    let record: PlanReadinessRecord | null = cached;
    if (isSelected && !args.workerBusy) {
      record = await ensureReadinessVerdict({
        runId: args.runId,
        planPath: candidate.path,
        planMarkdown,
        specPath: args.artifacts.specPath,
        specMarkdown,
      });
    }

    if (isSelected) {
      selectedRecord = record;
    }

    return {
      ...candidate,
      readinessRecord: record,
    };
  }));

  return { candidates: enriched, selectedRecord };
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
  const persistedEntries = worker ? await readWorkerOutputEntries(worker.runId, worker.id) : [];
  const persistedEntryText = persistedEntries
    .filter(isPlannerMessageEntry)
    .map((entry) => entry.text)
    .filter((text): text is string => Boolean(text?.trim()));
  const liveEntryText = (snapshot?.outputEntries ?? [])
    .filter(isPlannerMessageEntry)
    .map((entry) => entry.text)
    .filter((text) => Boolean(text.trim()));
  const outputText = collectTextParts(
    ...runMessages.filter((message) => message.role === "worker").map((message) => message.content),
    worker?.outputLog,
    worker?.lastText,
    snapshot?.lastText,
    ...persistedEntryText,
    ...liveEntryText,
    args.responseText ?? undefined,
  ).join("\n\n");

  const artifacts = await collectPlannerArtifacts({ cwd, outputText });
  const lastError = snapshot?.lastError ?? (isAgentBusyError(args.run.lastError) ? null : args.run.lastError);

  const rawWorkerState = (snapshot?.state ?? worker?.status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
  const workerBusy = WORKER_BUSY_STATES.has(rawWorkerState);

  const { candidates: enrichedCandidates, selectedRecord } = await attachReadinessRecordsToCandidates({
    runId: args.run.id,
    workerBusy,
    artifacts,
  });

  const enrichedArtifacts: PlannerArtifacts = {
    ...artifacts,
    candidates: enrichedCandidates,
  };

  let nextStatus = args.status;
  if (!nextStatus) {
    const reviewInProgress = (args.run.status === "reviewing_plan" || args.run.status === "revising_plan")
      ? await hasActiveReviewRun(args.run.id)
      : false;
    if (reviewInProgress) {
      nextStatus = args.run.status as PlanningConversationStatus;
    } else {
      nextStatus = derivePlanningStatus({
        workerState: snapshot?.state ?? worker?.status,
        lastError,
        artifacts: enrichedArtifacts,
      });
    }
  }

  const now = new Date();

  await db.update(runs).set({
    status: nextStatus,
    failedAt: nextStatus === "failed" ? args.run.failedAt ?? now : null,
    lastError: nextStatus === "failed" ? lastError : null,
    specPath: enrichedArtifacts.specPath,
    artifactPlanPath: enrichedArtifacts.planPath,
    plannerArtifactsJson: JSON.stringify(enrichedArtifacts),
    updatedAt: now,
  }).where(eq(runs.id, args.run.id));

  if (nextStatus === "ready" && args.run.status !== "ready") {
    emitNamedEvent({
      kind: "plan.ready",
      runId: args.run.id,
      planId: args.run.planId ?? null,
    });
  }

  return { artifacts: enrichedArtifacts, status: nextStatus, readinessRecord: selectedRecord };
}
