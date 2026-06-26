import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { runMilestoneAutoCommit } from "@/server/git/run-auto-commit";

type OutputEntryLike = {
  type?: string | null;
  text?: string | null;
  status?: string | null;
  raw?: unknown;
};

type WorkerOutputSource = {
  workerStatus?: string | null;
  responseText?: string | null;
  renderedOutput?: string | null;
  currentText?: string | null;
  lastText?: string | null;
  outputLog?: string | null;
  outputEntries?: readonly OutputEntryLike[] | null;
  outputEntriesJson?: string | null;
  pendingPermissions?: readonly unknown[] | null;
  pendingElicitations?: readonly unknown[] | null;
};

const ACTIVE_DIRECT_WORKER_STATUSES = new Set(["starting", "working", "stuck", "recovering"]);

function normalizeWorkerStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
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

function isOpenHumanInputEntry(entry: OutputEntryLike) {
  if (entry.type !== "permission" && entry.type !== "elicitation") {
    return false;
  }
  const status = (entry.status ?? "pending").trim().toLowerCase();
  return !["answered", "approved", "cancelled", "canceled", "completed", "declined", "denied", "failed", "rejected", "skipped"].includes(status);
}

function entryRequestId(entry: OutputEntryLike) {
  const raw = entry.raw;
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const requestId = (raw as { requestId?: unknown }).requestId;
  return typeof requestId === "number" && Number.isFinite(requestId) ? requestId : null;
}

function entriesHaveOpenHumanInput(entries: readonly OutputEntryLike[]) {
  const pendingByRequestId = new Map<string, boolean>();

  for (const entry of entries) {
    if (entry.type !== "permission" && entry.type !== "elicitation") {
      continue;
    }

    const open = isOpenHumanInputEntry(entry);
    const requestId = entryRequestId(entry);
    if (requestId === null) {
      if (open) {
        return true;
      }
      continue;
    }

    pendingByRequestId.set(`${entry.type}:${requestId}`, open);
  }

  return [...pendingByRequestId.values()].some(Boolean);
}

export function directWorkerOutputHasPendingHumanInput(source: WorkerOutputSource) {
  return (
    (source.pendingPermissions?.length ?? 0) > 0
    || (source.pendingElicitations?.length ?? 0) > 0
    || entriesHaveOpenHumanInput(source.outputEntries ?? [])
    || entriesHaveOpenHumanInput(parseOutputEntriesJson(source.outputEntriesJson))
  );
}

export function resolveDirectRunStatusFromWorkerOutput(source: WorkerOutputSource) {
  if (directWorkerOutputHasPendingHumanInput(source)) {
    return "awaiting_user";
  }

  if (ACTIVE_DIRECT_WORKER_STATUSES.has(normalizeWorkerStatus(source.workerStatus))) {
    return "running";
  }

  return "done";
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
  } else if (run.mode === "direct" && nextStatus === "done" && run.status !== "done") {
    await runMilestoneAutoCommit(args.runId, firstNonEmptyText([
      args.responseText,
      args.currentText,
      args.lastText,
      latestVisibleEntryText(args.outputEntries),
      latestVisibleEntryText(parseOutputEntriesJson(args.outputEntriesJson)),
      args.renderedOutput,
      args.outputLog,
    ]));
    notifyEventStreamSubscribers();
  } else if (nextStatus !== run.status || run.failedAt || run.lastError) {
    notifyEventStreamSubscribers();
  }

  return nextStatus;
}

export async function updateDirectRunAwaitingUserInputIfRequested(args: WorkerOutputSource & {
  runId: string;
  workerId?: string | null;
}) {
  if (!directWorkerOutputHasPendingHumanInput(args)) {
    return false;
  }

  await updateDirectRunStatusFromWorkerOutput(args);
  return true;
}
