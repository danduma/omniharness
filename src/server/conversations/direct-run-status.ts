import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { recordExecutionEvent } from "@/server/events/execution-event-store";

type OutputEntryLike = {
  type?: string | null;
  text?: string | null;
};

type WorkerOutputSource = {
  responseText?: string | null;
  renderedOutput?: string | null;
  currentText?: string | null;
  lastText?: string | null;
  outputLog?: string | null;
  outputEntries?: readonly OutputEntryLike[] | null;
  outputEntriesJson?: string | null;
};

const USER_INPUT_REQUEST_PATTERNS = [
  /\bwhich\s+(?:approach|option|path|one|choice|of these)\b.{0,120}\b(?:do you want|would you like|should i|should we)\b/i,
  /\b(?:what|how)\b.{0,120}\b(?:do you want|would you like)\b/i,
  /\bshould\s+(?:i|we)\b/i,
  /\bdo you want me to\b/i,
  /\bwould you like me to\b/i,
  /\bplease\s+(?:confirm|choose|pick|select|tell me|let me know)\b/i,
  /\b(?:choose|pick|select)\s+(?:an?\s+)?(?:option|approach|path|choice)\b/i,
  /\blet me know\s+(?:which|whether|how|what|if)\b/i,
  /\bneed\s+(?:your|a)\s+(?:confirmation|decision|approval|input|direction)\b/i,
  /\bwaiting for\s+(?:your|user)\s+(?:confirmation|decision|approval|input|direction)\b/i,
  /\bbefore\s+(?:i|we)\s+(?:proceed|continue|do that|make|merge|delete|change|apply|commit|stash)\b/i,
];

function normalizeOutputText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function parseOutputEntriesJson(value: string | null | undefined): OutputEntryLike[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is OutputEntryLike => {
      return typeof entry === "object" && entry !== null;
    }) : [];
  } catch {
    return [];
  }
}

function visibleEntryText(entries: readonly OutputEntryLike[] | null | undefined) {
  return (entries ?? [])
    .filter((entry) => !entry.type || entry.type === "message")
    .map((entry) => entry.text ?? "")
    .filter((text) => text.trim().length > 0);
}

function latestVisibleEntryText(entries: readonly OutputEntryLike[] | null | undefined) {
  return visibleEntryText(entries).at(-1) ?? "";
}

function firstNonEmptyText(values: ReadonlyArray<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
}

export function directWorkerOutputRequestsUserInput(source: WorkerOutputSource) {
  const text = normalizeOutputText(firstNonEmptyText([
    source.responseText,
    source.currentText,
    source.lastText,
    latestVisibleEntryText(source.outputEntries),
    latestVisibleEntryText(parseOutputEntriesJson(source.outputEntriesJson)),
    source.renderedOutput,
    source.outputLog,
  ]));

  if (!text) {
    return false;
  }

  return USER_INPUT_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}

export function resolveDirectRunStatusFromWorkerOutput(source: WorkerOutputSource) {
  return directWorkerOutputRequestsUserInput(source) ? "awaiting_user" : "done";
}

export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSource & {
  runId: string;
  workerId?: string | null;
}) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || (run.mode !== "direct" && run.mode !== "commit")) {
    return null;
  }

  const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
  const now = new Date();
  await db.update(runs).set({
    status: nextStatus,
    failedAt: null,
    lastError: null,
    updatedAt: now,
  }).where(eq(runs.id, args.runId));

  if (nextStatus === "awaiting_user" && run.status !== "awaiting_user") {
    emitNamedEvent({
      kind: "conversation.awaiting_user",
      runId: args.runId,
      workerId: args.workerId ?? undefined,
      reason: "worker_requested_input",
    });
    await recordExecutionEvent({
      runId: args.runId,
      workerId: args.workerId ?? null,
      planItemId: null,
      eventType: "direct_worker_awaiting_user",
      details: { reason: "worker_requested_input" },
      createdAt: now,
    });
  } else if (nextStatus !== run.status || run.failedAt || run.lastError) {
    notifyEventStreamSubscribers();
  }

  return nextStatus;
}

export async function updateDirectRunAwaitingUserInputIfRequested(args: WorkerOutputSource & {
  runId: string;
  workerId?: string | null;
}) {
  if (!directWorkerOutputRequestsUserInput(args)) {
    return false;
  }

  await updateDirectRunStatusFromWorkerOutput(args);
  return true;
}
