/**
 * Closing out human-input requests that the runtime no longer holds.
 *
 * Elicitations and permissions live in two places: the runtime's in-memory
 * `pendingElicitations`/`pendingPermissions` (the promise the agent is blocked
 * on) and the durable worker stream (an append-only `pending` row, later
 * superseded by a terminal row). Every UI surface derives "is this question
 * still open?" from the stream, because `/api/events` strips
 * `agent.outputEntries` and a live snapshot does not always carry the pending
 * arrays.
 *
 * The two can diverge: if the runtime process dies, or a worker is torn down
 * and respawned, the in-memory request disappears without a terminal row ever
 * being written. The stream then advertises a question forever — the user
 * answers it, the runtime replies `no_pending_elicitations`, and the card comes
 * straight back on the next poll. Nothing short of dropping the transcript
 * clears it.
 *
 * So when the runtime tells us a request is gone, write the terminal row it
 * never got to write. Every derived surface — the inline card, direct run
 * status, queued-message drain — converges on "closed" from that one row.
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import type { AgentOutputEntry } from "@/lib/agent-output";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";

export type HumanInputKind = "elicitation" | "permission";

type ReconcileHumanInputResult = {
  closedElicitationRequestIds: number[];
  closedPermissionRequestIds: number[];
};

const TERMINAL_STATUSES = new Set([
  "answered",
  "approved",
  "cancelled",
  "canceled",
  "completed",
  "declined",
  "denied",
  "failed",
  "rejected",
  "skipped",
]);

function isOpen(entry: WorkerEntry) {
  return !TERMINAL_STATUSES.has((entry.status ?? "pending").trim().toLowerCase());
}

function entryRequestId(entry: WorkerEntry) {
  const raw = entry.raw;
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const requestId = (raw as { requestId?: unknown }).requestId;
  return typeof requestId === "number" && Number.isFinite(requestId) ? requestId : null;
}

/**
 * Fold the stream by request id and return the ids of `kind` requests that are
 * still open. Later terminal rows win, exactly like every other reader.
 */
function openRequestIds(entries: readonly WorkerEntry[], kind: HumanInputKind) {
  const openById = new Map<number, boolean>();
  for (const entry of entries) {
    if (entry.type !== kind) continue;
    const requestId = entryRequestId(entry);
    if (requestId === null) continue;
    openById.set(requestId, isOpen(entry));
  }
  return [...openById.entries()].filter(([, open]) => open).map(([requestId]) => requestId);
}

/**
 * Retire durable requests that a freshly recovered runtime does not own.
 *
 * The runtime's pending arrays are authoritative because they represent the
 * live promises that can still consume a response. The worker stream is
 * history. A runner crash can leave a `pending` stream row behind after that
 * promise is gone, so recovery must append a terminal row before the UI can
 * mistake the historical request for an actionable one.
 */
export async function reconcileRecoveredHumanInputEntries(args: {
  runId: string;
  workerId: string;
  activeElicitationRequestIds: readonly number[];
  activePermissionRequestIds: readonly number[];
  reason?: string;
}): Promise<ReconcileHumanInputResult> {
  const entries = await readWorkerOutputEntries(args.runId, args.workerId);
  const activeElicitationIds = new Set(args.activeElicitationRequestIds);
  const activePermissionIds = new Set(args.activePermissionRequestIds);
  const staleElicitationIds = openRequestIds(entries, "elicitation")
    .filter((requestId) => !activeElicitationIds.has(requestId));
  const stalePermissionIds = openRequestIds(entries, "permission")
    .filter((requestId) => !activePermissionIds.has(requestId));
  const reason = args.reason?.trim() || "the recovered runtime no longer owns this request";
  const timestamp = new Date().toISOString();

  const terminalEntries: AgentOutputEntry[] = [
    ...staleElicitationIds.map((requestId): AgentOutputEntry => ({
      id: randomUUID(),
      type: "elicitation",
      status: "cancelled",
      text: `Question cancelled for request ${requestId}: ${reason}`,
      timestamp,
      authorRole: "system",
      channel: "system",
      raw: { requestId, action: "cancel", reconciled: true, reason },
    })),
    ...stalePermissionIds.map((requestId): AgentOutputEntry => ({
      id: randomUUID(),
      type: "permission",
      status: "cancelled",
      text: `Permission cancelled for request ${requestId}: ${reason}`,
      timestamp,
      authorRole: "system",
      channel: "system",
      raw: { requestId, decision: "cancel", reconciled: true, reason },
    })),
  ];

  if (terminalEntries.length > 0) {
    await writeWorkerOutputEntries(args.runId, args.workerId, terminalEntries);
  }
  if (staleElicitationIds.length > 0) {
    emitNamedEvent({
      kind: "worker.human_input_reconciled",
      runId: args.runId,
      workerId: args.workerId,
      interaction: "elicitation",
      closedRequestIds: staleElicitationIds,
      activeRequestIds: [...args.activeElicitationRequestIds],
      reason,
    });
  }
  if (stalePermissionIds.length > 0) {
    emitNamedEvent({
      kind: "worker.human_input_reconciled",
      runId: args.runId,
      workerId: args.workerId,
      interaction: "permission",
      closedRequestIds: stalePermissionIds,
      activeRequestIds: [...args.activePermissionRequestIds],
      reason,
    });
  }

  return {
    closedElicitationRequestIds: staleElicitationIds,
    closedPermissionRequestIds: stalePermissionIds,
  };
}

/**
 * Mark the given worker's open `kind` requests as cancelled in the durable
 * stream. When `requestId` is supplied only that request is closed; otherwise
 * every open one is (the runtime holds none of them, or it would not have
 * reported `no_pending_*`).
 *
 * Never throws: this runs on an error path, and failing to tidy up must not
 * replace the caller's real error with a worse one.
 */
export async function closeStaleHumanInputEntries(args: {
  workerId: string;
  kind: HumanInputKind;
  requestId?: number;
  reason?: string;
}): Promise<number> {
  try {
    const worker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
    if (!worker) {
      return 0;
    }

    const entries = await readWorkerOutputEntries(worker.runId, args.workerId);
    const open = openRequestIds(entries, args.kind).filter(
      (requestId) => args.requestId === undefined || requestId === args.requestId,
    );
    if (open.length === 0) {
      return 0;
    }

    const noun = args.kind === "elicitation" ? "Question" : "Permission";
    const reason = args.reason?.trim() || "the worker is no longer waiting for it";
    const timestamp = new Date().toISOString();
    await writeWorkerOutputEntries(worker.runId, args.workerId, open.map((requestId): AgentOutputEntry => ({
      id: randomUUID(),
      type: args.kind,
      status: "cancelled",
      text: `${noun} cancelled for request ${requestId}: ${reason}`,
      timestamp,
      authorRole: "system",
      channel: "system",
      raw: { requestId, decision: "cancel", action: "cancel", reconciled: true },
    })));

    return open.length;
  } catch {
    return 0;
  }
}
