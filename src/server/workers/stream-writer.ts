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
import { appendWorkerEntryWithResult } from "@/server/workers/output-store";
import type {
  WorkerEntry,
  WorkerEntryAttachment,
  WorkerEntryAuthorRole,
  WorkerEntryChannel,
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

export type AppendSessionInputArgs = AppendUserInputArgs & {
  channel?: WorkerEntryChannel;
};

export type AppendProcessOutputArgs = {
  runId: string;
  workerId: string;
  text: string;
  channel: Extract<WorkerEntryChannel, "stdout" | "stderr">;
  timestamp?: Date;
};

export type AppendAssistantMessageArgs = {
  runId: string;
  workerId: string;
  text: string;
  timestamp?: Date;
  raw?: unknown;
};

export type AppendSessionLifecycleArgs = AppendLifecycleArgs & {
  channel?: WorkerEntryChannel;
};

function persistAndAnnounce(args: {
  runId: string;
  workerId: string;
  entry: Omit<WorkerEntry, "seq">;
}): Promise<WorkerEntry | null> {
  return appendWorkerEntryWithResult(args.runId, args.workerId, args.entry).then((result) => {
    const persisted = result.entry;
    if (!result.appended || typeof persisted.seq !== "number" || persisted.seq <= 0) {
      return persisted;
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

export async function appendUserInputOnDelivery(args: AppendUserInputArgs): Promise<WorkerEntry | null> {
  return persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: args.id ?? randomUUID(),
      type: "user_input",
      text: args.text,
      timestamp: args.deliveredAt.toISOString(),
      authorRole: args.authorRole ?? "user",
      channel: "stdin",
      attachments: args.attachments,
    },
  });
}

export async function appendSessionInputEntry(args: AppendSessionInputArgs): Promise<WorkerEntry | null> {
  return persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: args.id ?? randomUUID(),
      type: "user_input",
      text: args.text,
      timestamp: args.deliveredAt.toISOString(),
      authorRole: args.authorRole ?? "user",
      channel: args.channel ?? "stdin",
      attachments: args.attachments,
    },
  });
}

export async function appendProcessOutputEntry(args: AppendProcessOutputArgs): Promise<void> {
  await persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: randomUUID(),
      type: "message",
      text: args.text,
      timestamp: (args.timestamp ?? new Date()).toISOString(),
      authorRole: "system",
      channel: args.channel,
      raw: { source: "process", channel: args.channel },
    },
  });
}

export async function appendAssistantMessageEntry(args: AppendAssistantMessageArgs): Promise<void> {
  const text = args.text.trim();
  if (!text) {
    return;
  }
  await persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: randomUUID(),
      type: "message",
      text,
      timestamp: (args.timestamp ?? new Date()).toISOString(),
      authorRole: "assistant",
      channel: "agent",
      raw: args.raw,
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
      channel: "system",
      raw: args.raw,
    },
  });
}

export async function appendSessionLifecycleEntry(args: AppendSessionLifecycleArgs): Promise<void> {
  await persistAndAnnounce({
    runId: args.runId,
    workerId: args.workerId,
    entry: {
      id: randomUUID(),
      type: "lifecycle",
      text: args.text,
      timestamp: (args.timestamp ?? new Date()).toISOString(),
      authorRole: "system",
      channel: args.channel ?? "system",
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
      channel: "system",
      raw: args.raw,
    },
  });
}
