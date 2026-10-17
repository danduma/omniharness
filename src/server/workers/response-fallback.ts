import type { AgentRecord } from "@/server/bridge-client";
import { emitNamedEvent } from "@/server/events/named-events";
import { readWorkerEntriesTail, readWorkerOutputEntries } from "@/server/workers/output-store";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { appendAssistantMessageEntry } from "@/server/workers/stream-writer";

type SnapshotLike = Pick<AgentRecord, "outputEntries"> | null;

function snapshotHasAssistantMessage(snapshot: SnapshotLike) {
  return Boolean(snapshot?.outputEntries?.some((entry) => (
    (entry.type === "message" || entry.type === "thought")
    && entry.text.trim().length > 0
  )));
}

// Only inspect the current input's output. An earlier turn's answer must not
// hide a response that arrived without streaming any message entries.
function currentTurnHasMessage(entries: readonly WorkerEntry[]): boolean | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === "user_input" || entry.type === "supervisor_input") return false;
    if (entry.type === "message" && entry.text.trim()) return true;
  }
  return undefined;
}

async function persistedTurnHasMessage(runId: string, workerId: string): Promise<boolean> {
  const tail = await readWorkerEntriesTail(runId, workerId, 200);
  if (tail) {
    const found = currentTurnHasMessage(tail.entries);
    if (found !== undefined) return found;
    if (!tail.hasOlder) return false;
  }
  // A long tool-only tail or legacy stream needs the canonical history. This
  // runs only when the live snapshot cannot supply the transcript, not per delta.
  return currentTurnHasMessage(await readWorkerOutputEntries(runId, workerId)) === true;
}

export async function appendAskResponseFallbackEntry(args: {
  runId: string;
  workerId: string;
  responseText: string | null | undefined;
  snapshot: SnapshotLike;
  expectedTurnGeneration?: number;
}) {
  const text = args.responseText?.trim();
  if (!text || snapshotHasAssistantMessage(args.snapshot)) {
    return;
  }

  // Recovery may have dropped/replaced the live snapshot while its messages
  // remain durable. responseText is a turn-wide concatenation, not a final
  // message, so appending it would duplicate prose and erase its boundaries.
  if (await persistedTurnHasMessage(args.runId, args.workerId)) {
    emitNamedEvent({ kind: "worker.response_fallback_skipped", runId: args.runId, workerId: args.workerId, reason: "persisted_message" });
    return;
  }

  await appendAssistantMessageEntry({
    runId: args.runId,
    workerId: args.workerId,
    text,
    raw: { source: "ask_response_fallback" },
    expectedTurnGeneration: args.expectedTurnGeneration,
  });
}
