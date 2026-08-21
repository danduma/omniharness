import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { listExecutionEventSummariesForSnapshot } from "@/server/events/execution-event-store";
import { parseGitBaselineJson } from "@/server/git/auto-commit";
import { readWorkerEntriesTail } from "@/server/workers/output-store";
import type { WorkerEntry } from "@/shared/worker-entries";
import type { HandoffVerification } from "@/shared/handoff";
import { redactHandoffText } from "./redaction";
import { collectHandoffWorkspaceState } from "./workspace-state";
import { parseSupersededSeqRanges, withoutSupersededEntries } from "@/lib/superseded-entries";

const MAX_WORKER_ENTRIES = 160;

export type WorkerEntryCandidates = {
  recentUserMessages: string[];
  recentAssistantSummary: string | null;
  verificationText: string[];
};

export function selectWorkerEntryCandidates(entries: readonly WorkerEntry[], sourceSeq: number | null): WorkerEntryCandidates {
  const bounded = entries.filter((entry) => sourceSeq == null || entry.seq <= sourceSeq);
  const visible = bounded.filter((entry) => entry.type !== "thought" && entry.type !== "user_message_chunk" && !entry.diagnosticOnly);
  const recentUserMessages = visible
    .filter((entry) => entry.type === "user_input" || entry.authorRole === "user")
    .map((entry) => redactHandoffText(entry.text, 1_500))
    .filter(Boolean)
    .slice(-6);
  const assistantEntries = visible.filter((entry) => (
    (entry.type === "message" || entry.type === "agent_content")
    && (entry.authorRole === "assistant" || entry.authorRole == null)
    && entry.text.trim()
  ));
  const verificationText = visible
    .filter((entry) => entry.type === "tool_call_update" && /\b(tests?|build|lint|typecheck|check|verify|pass|fail)\b/i.test(entry.text))
    .map((entry) => redactHandoffText(entry.text, 1_000))
    .slice(-20);
  return {
    recentUserMessages,
    recentAssistantSummary: assistantEntries.length > 0
      ? redactHandoffText(assistantEntries.at(-1)?.text, 3_000) || null
      : null,
    verificationText,
  };
}

export type GatheredHandoffCandidates = {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect | null;
  originalRequest: string | null;
  currentObjective: string | null;
  recentUserMessages: string[];
  recentAssistantSummary: string | null;
  queuedMessages: string[];
  verification: HandoffVerification[];
  workspace: Awaited<ReturnType<typeof collectHandoffWorkspaceState>>;
  sourceSeq: number | null;
  plans: string[];
  specs: string[];
  generatedOutputs: string[];
};

export async function gatherHandoffCandidates(args: {
  runId: string;
  workerId: string | null;
  sourceSeq?: number | null;
  forkedFromMessageId?: string | null;
}): Promise<GatheredHandoffCandidates> {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run) throw new Error(`Run ${args.runId} not found.`);
  const worker = args.workerId
    ? await db.select().from(workers).where(and(eq(workers.id, args.workerId), eq(workers.runId, args.runId))).get() ?? null
    : await db.select().from(workers).where(eq(workers.runId, args.runId)).orderBy(desc(workers.updatedAt), desc(workers.id)).limit(1).get() ?? null;

  const tail = worker ? await readWorkerEntriesTail(args.runId, worker.id, MAX_WORKER_ENTRIES) : null;
  const visibleTailEntries = withoutSupersededEntries(tail?.entries ?? [], parseSupersededSeqRanges(worker?.supersededSeqRanges));
  const forkEntry = args.forkedFromMessageId
    ? visibleTailEntries.find((entry) => entry.id === args.forkedFromMessageId && entry.type === "user_input")
    : null;
  const sourceSeq = args.sourceSeq ?? tail?.latestSeq ?? (worker ? 0 : null);
  const contentBoundarySeq = args.forkedFromMessageId ? forkEntry?.seq ?? -1 : sourceSeq;
  const streamCandidates = selectWorkerEntryCandidates(visibleTailEntries, contentBoundarySeq);
  const boundaryMessage = args.forkedFromMessageId
    ? await db.select().from(messages).where(and(eq(messages.id, args.forkedFromMessageId), eq(messages.runId, args.runId))).get()
    : null;
  if (args.forkedFromMessageId && !boundaryMessage) throw new Error("The requested fork message does not belong to the source conversation.");
  const boundedMessages = (await db.select().from(messages)
    .where(boundaryMessage ? and(eq(messages.runId, args.runId), lte(messages.createdAt, boundaryMessage.createdAt)) : eq(messages.runId, args.runId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(80)).reverse();
  const originalUserMessage = await db.select().from(messages)
    .where(and(
      eq(messages.runId, args.runId),
      eq(messages.role, "user"),
      ...(boundaryMessage ? [lte(messages.createdAt, boundaryMessage.createdAt)] : []),
    ))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(1).get();
  const userMessages = boundedMessages.filter((message) => message.role === "user" && !message.supersededAt);
  const assistantMessages = boundedMessages.filter((message) => message.role === "assistant" && !message.supersededAt);
  const pendingQueued = await db.select().from(queuedConversationMessages)
    .where(and(
      eq(queuedConversationMessages.runId, args.runId),
      inArray(queuedConversationMessages.status, ["pending", "delivering"]),
    ))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id))
    .limit(20);
  const queuedMessages = pendingQueued.map((message) => redactHandoffText(message.content, 1_000));
  const eventRows = await listExecutionEventSummariesForSnapshot(args.runId, 40);
  const verification: HandoffVerification[] = [
    ...streamCandidates.verificationText.map((importantOutput) => ({ command: "worker tool verification", result: /\b(pass|success|exit 0)\b/i.test(importantOutput) ? "passed" as const : /\b(fail|error|exit [1-9])\b/i.test(importantOutput) ? "failed" as const : "unknown" as const, exitCode: null, importantOutput })),
    ...eventRows.filter((event) => /test|build|lint|typecheck|verify/i.test(event.eventType)).map((event) => ({
      command: event.eventType,
      result: /fail|error/i.test(event.eventType) ? "failed" as const : /pass|complete|success/i.test(event.eventType) ? "passed" as const : "unknown" as const,
      exitCode: null,
      importantOutput: event.detailsPreview ? redactHandoffText(event.detailsPreview, 1_000) : null,
    })),
  ].slice(-30);
  const workspace = await collectHandoffWorkspaceState({
    projectPath: run.projectPath ?? worker?.cwd ?? process.cwd(),
    baseline: parseGitBaselineJson(run.gitBaselineJson),
  });
  let plannerOutputs: string[] = [];
  try {
    const parsed: unknown = run.plannerArtifactsJson ? JSON.parse(run.plannerArtifactsJson) : [];
    if (Array.isArray(parsed)) plannerOutputs = parsed.flatMap((entry) => typeof entry === "string" ? [entry] : entry && typeof entry === "object" && "path" in entry && typeof entry.path === "string" ? [entry.path] : []);
  } catch {
    plannerOutputs = [];
  }

  return {
    run,
    worker,
    originalRequest: originalUserMessage?.content ? redactHandoffText(originalUserMessage.content, 4_000) : worker?.initialPrompt ? redactHandoffText(worker.initialPrompt, 4_000) : null,
    currentObjective: userMessages.at(-1)?.content ? redactHandoffText(userMessages.at(-1)?.content, 2_000) : null,
    recentUserMessages: streamCandidates.recentUserMessages.length > 0
      ? streamCandidates.recentUserMessages
      : userMessages.slice(-6).map((message) => redactHandoffText(message.content, 1_500)),
    recentAssistantSummary: streamCandidates.recentAssistantSummary
      ?? (assistantMessages.at(-1)?.content ? redactHandoffText(assistantMessages.at(-1)?.content, 3_000) : null),
    queuedMessages,
    verification,
    workspace,
    sourceSeq,
    plans: [run.artifactPlanPath].filter((value): value is string => Boolean(value)),
    specs: [run.specPath].filter((value): value is string => Boolean(value)),
    generatedOutputs: plannerOutputs,
  };
}
