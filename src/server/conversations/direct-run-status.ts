import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { recoveryIncidents, runs, workers } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { runMilestoneAutoCommit } from "@/server/git/run-auto-commit";

const ACTIVE_QUOTA_INCIDENT_STATUSES = ["open", "recovering"] as const;

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

// Trailing "?", tolerating closing quotes/brackets and trailing punctuation.
const QUESTION_TAIL_PATTERN = /\?["'”’)\]]*[.\s]*$/;
const OPTIONAL_FOLLOW_UP_OFFER_PATTERN = /(?:^|[.!]\s+)(?:do you want me to|would you like me to|want me to)\b[^?]*\?["'”’)\]]*[.\s]*$/i;

function lastNonEmptyLine(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
}

function endsWithQuestion(text: string) {
  const lastLine = lastNonEmptyLine(text);
  return Boolean(lastLine && QUESTION_TAIL_PATTERN.test(lastLine));
}

function endsWithOptionalFollowUpOffer(text: string) {
  const lastLine = lastNonEmptyLine(text);
  return Boolean(lastLine && OPTIONAL_FOLLOW_UP_OFFER_PATTERN.test(lastLine));
}

/**
 * A worker can block on the user without ever raising a structured permission
 * or elicitation — it just asks in prose and goes idle. Treating that as "done"
 * marks the conversation finished in the UI while the worker is in fact waiting
 * for an answer, so the question is never surfaced and never answered.
 */
export function directWorkerOutputAsksBlockingQuestion(source: WorkerOutputSource) {
  // Deliberately entry-derived only. `outputLog`/`lastText` on a persisted
  // worker row are stale prose that outlive the turn, and reconciling an
  // already-finished conversation off them would flip it back to awaiting_user
  // forever. Message entries only exist for a turn that actually just spoke.
  const latestText = firstNonEmptyText([
    latestVisibleEntryText(source.outputEntries),
    latestVisibleEntryText(parseOutputEntriesJson(source.outputEntriesJson)),
  ]);

  return endsWithQuestion(latestText) && !endsWithOptionalFollowUpOffer(latestText);
}

export function resolveDirectRunStatusFromWorkerOutput(source: WorkerOutputSource) {
  if (directWorkerOutputHasPendingHumanInput(source)) {
    return "awaiting_user";
  }

  // A quota-blocked worker is idle, but the conversation is emphatically not
  // finished — it is parked waiting for the provider window to reopen. Letting
  // it fall through to "done" below silently cleared the run out of
  // `quota_waiting`, which hid the "waiting for quota reset" banner and (until
  // recovery stopped keying off `runs.status`) stranded the resume entirely.
  if (normalizeWorkerStatus(source.workerStatus) === "cred-exhausted") {
    return "quota_waiting";
  }

  if (ACTIVE_DIRECT_WORKER_STATUSES.has(normalizeWorkerStatus(source.workerStatus))) {
    return "running";
  }

  // Only once the worker has stopped: a question mid-turn is just narration.
  return directWorkerOutputAsksBlockingQuestion(source) ? "awaiting_user" : "done";
}

export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSource & {
  runId: string;
  workerId?: string | null;
}) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || (run.mode !== "direct" && run.mode !== "commit")) {
    return null;
  }

  const quotaIncident = await db.select({ id: recoveryIncidents.id })
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, args.runId),
      eq(recoveryIncidents.kind, "quota_exhausted"),
      inArray(recoveryIncidents.status, [...ACTIVE_QUOTA_INCIDENT_STATUSES]),
    ))
    .limit(1)
    .get();
  const quotaWorker = args.workerId
    ? await db.select({ status: workers.status }).from(workers).where(eq(workers.id, args.workerId)).get()
    : null;
  const quotaRecoveryOwnsPersistedState = Boolean(
    quotaIncident
    && (
      run.status === "quota_waiting"
      || normalizeWorkerStatus(quotaWorker?.status) === "cred-exhausted"
    ),
  );
  if (quotaIncident && quotaRecoveryOwnsPersistedState) {
    const normalizedRunStatus = run.status.trim().toLowerCase();
    if (normalizedRunStatus === "cancelled" || normalizedRunStatus === "canceled" || normalizedRunStatus === "done") {
      return run.status;
    }

    if (run.status !== "quota_waiting" || run.failedAt || run.lastError) {
      const updated = await db.update(runs).set({
        status: "quota_waiting",
        failedAt: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(and(
        eq(runs.id, args.runId),
        eq(runs.status, run.status),
      )).returning({ id: runs.id });
      if (updated.length > 0) {
        emitNamedEvent({
          kind: "recovery.quota_wait_preserved",
          runId: args.runId,
          incidentId: quotaIncident.id,
          previousStatus: run.status,
        });
        await recordExecutionEvent({
          runId: args.runId,
          workerId: args.workerId ?? null,
          planItemId: null,
          eventType: "quota_wait_preserved",
          details: {
            summary: "Kept quota recovery authoritative over a stale direct-run status.",
            incidentId: quotaIncident.id,
            previousStatus: run.status,
          },
        });
        notifyEventStreamSubscribers();
      }
    }
    return "quota_waiting";
  }

  const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
  const now = new Date();
  if (run.status !== nextStatus || run.failedAt || run.lastError) {
    await db.update(runs).set({
      status: nextStatus,
      failedAt: null,
      lastError: null,
      updatedAt: now,
    }).where(eq(runs.id, args.runId));
  }

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
