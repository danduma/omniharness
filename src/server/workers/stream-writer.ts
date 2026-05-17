/**
 * Thin helpers around `appendWorkerEntry` for the unified worker
 * conversation stream. Each helper:
 *
 *   1. Builds a `WorkerEntry` of the appropriate type with a generated
 *      uuid (server-produced entries don't have a stable upstream id).
 *   2. Appends via `appendWorkerEntry` (which assigns the seq and holds
 *      the per-worker chain).
 *   3. After fsync, emits a `worker.entry_appended` named event carrying
 *      only `{ workerId, seq }`. The full entry is fetched via the
 *      entries endpoint — the SSE frame is a wake-up hint, not a content
 *      carrier.
 *
 * Append-on-delivery semantics: ordinary follow-up callers MUST invoke
 * these only after `askAgent` (or the equivalent delivery primitive)
 * has resolved successfully. Initial direct/planning prompts are the
 * exception: the conversation has already accepted the message, and the
 * prompt must anchor the worker stream before bridge progress snapshots
 * can append output while the first ask is still in flight.
 */
import { randomUUID } from "node:crypto";
import { emitNamedEvent } from "@/server/events/named-events";
import { appendWorkerEntry } from "@/server/workers/output-store";
import type {
  WorkerEntry,
  WorkerEntryAttachment,
  WorkerEntryAuthorRole,
} from "@/server/workers/entries-types";

export type AppendUserInputArgs = {
  runId: string;
  workerId: string;
  text: string;
  deliveredAt: Date;
  authorRole?: WorkerEntryAuthorRole;
  attachments?: WorkerEntryAttachment[];
  /** Optional stable id (e.g. from a messages row) so dedup across recovery works. */
  id?: string;
};

export type AppendSupervisorInputArgs = {
  runId: string;
  workerId: string;
  text: string;
  deliveredAt: Date;
  id?: string;
};

export type AppendLifecycleArgs = {
  runId: string;
  workerId: string;
  text: string;
  raw?: unknown;
  timestamp?: Date;
};

export type AppendSystemNoteArgs = {
  runId: string;
  workerId: string;
  text: string;
  raw?: unknown;
};

function persistAndAnnounce(args: {
  runId: string;
  workerId: string;
  entry: Omit<WorkerEntry, "seq">;
}): Promise<WorkerEntry | null> {
  return appendWorkerEntry(args.runId, args.workerId, args.entry).then((persisted) => {
    if (!persisted || typeof persisted.seq !== "number" || persisted.seq <= 0) {
      return persisted ?? null;
    }
    emitNamedEvent({
      kind: "worker.entry_appended",
      runId: args.runId,
      workerId: args.workerId,
      seq: persisted.seq,
    });
    return persisted;
  });
}

export async function appendUserInputOnDelivery(args: AppendUserInputArgs): Promise<void> {
  await persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: args.id ?? randomUUID(),
      type: "user_input",
      text: args.text,
      timestamp: args.deliveredAt.toISOString(),
      authorRole: args.authorRole ?? "user",
      attachments: args.attachments,
    },
  });
}

export async function appendSupervisorInputOnDelivery(args: AppendSupervisorInputArgs): Promise<void> {
  await persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: args.id ?? randomUUID(),
      type: "supervisor_input",
      text: args.text,
      timestamp: args.deliveredAt.toISOString(),
      authorRole: "supervisor",
    },
  });
}

export async function appendLifecycleEntry(args: AppendLifecycleArgs): Promise<void> {
  await persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: randomUUID(),
      type: "lifecycle",
      text: args.text,
      timestamp: (args.timestamp ?? new Date()).toISOString(),
      authorRole: "system",
      raw: args.raw,
    },
  });
}

export async function appendSystemNote(args: AppendSystemNoteArgs): Promise<void> {
  await persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: randomUUID(),
      type: "system_note",
      text: args.text,
      timestamp: new Date().toISOString(),
      authorRole: "system",
      raw: args.raw,
    },
  });
}
