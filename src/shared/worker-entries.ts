/**
 * Shared on-disk and on-wire schema for the unified worker conversation
 * stream. See docs/architecture/worker-conversation-stream.md and the
 * implementation plan at
 * docs/superpowers/plans/2026-05-16-unified-worker-conversation-stream.md.
 *
 * The bridge keeps emitting its own narrower `BridgeOutputEntry` shape
 * (defined in src/server/bridge-client/index.ts). Bridge entries are
 * converted to `WorkerEntry` at the writer boundary in
 * `src/server/workers/output-store.ts#appendWorkerEntry`. Code outside the
 * writer never constructs a `WorkerEntry` for a bridge entry.
 */

export type WorkerEntryAuthorRole = "user" | "assistant" | "supervisor" | "system";
export type WorkerEntryChannel = "stdout" | "stderr" | "stdin" | "system" | "agent";

export type WorkerEntryAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
};

export type BridgeWorkerEntryType =
  | "message"
  | "thought"
  | "tool_call"
  | "tool_call_update"
  | "permission"
  | "elicitation"
  | "user_message_chunk"
  | "plan"
  | "plan_update"
  | "plan_removed"
  | "available_commands"
  | "current_mode"
  | "config_option"
  | "session_info"
  | "usage"
  | "agent_content"
  | "user_content";

export type ServerWorkerEntryType =
  | "user_input"
  | "supervisor_input"
  | "system_note"
  | "lifecycle";

export type WorkerEntryType = BridgeWorkerEntryType | ServerWorkerEntryType;

export type WorkerPlanProjection =
  | "accepted_core"
  | "session_reset"
  | "rejected"
  | "unsupported"
  | "stale";

export interface WorkerEntry {
  /** Stable id from the bridge for bridge entries; uuid for server-produced entries. */
  id: string;
  /** Monotonic per (runId, workerId), assigned at write time by the writer. */
  seq: number;
  type: WorkerEntryType;
  text: string;
  /** For server-produced entries: the delivery timestamp. For bridge entries: bridge clock. */
  timestamp: string;
  toolCallId?: string | null;
  toolKind?: string | null;
  status?: string | null;
  raw?: unknown;
  authorRole?: WorkerEntryAuthorRole;
  channel?: WorkerEntryChannel;
  attachments?: WorkerEntryAttachment[];
  /** ACP session identity for plan-bearing and plan-boundary entries. */
  acpSessionId?: string | null;
  /** Explicit projection classification; payload shape never implies acceptance. */
  planProjection?: WorkerPlanProjection;
  /** Protocol/debug rows and session boundaries never enter ordinary conversation UI. */
  diagnosticOnly?: boolean;
  /** Normalized complete-list core plan, present only for accepted_core entries. */
  normalizedPlan?: import("./acp-plan").AcpPlanItem[];
}

/**
 * Collapse append-only revisions and cross-worker copies of one logical entry
 * into the item the conversation UI renders. Position comes from the first
 * appearance; content comes from the latest revision; timestamp placement
 * follows the newest worker that owns a copy of the entry.
 */
export function coalesceWorkerEntriesById(
  entries: ReadonlyArray<WorkerEntry>,
  workerOrder: ReadonlyArray<string> = [],
): WorkerEntry[] {
  const workerRank = new Map(workerOrder.map((workerId, index) => [workerId, index]));
  const rankOf = (entry: WorkerEntry) => {
    const workerId = (entry as WorkerEntry & { workerId?: unknown }).workerId;
    return typeof workerId === "string" ? workerRank.get(workerId) ?? -1 : -1;
  };

  const positionByKey = new Map<string, number>();
  const placementByKey = new Map<string, { timestamp: string; rank: number }>();
  const result: WorkerEntry[] = [];
  for (const entry of entries) {
    const key = typeof entry.id === "string" && entry.id ? entry.id : null;
    if (!key) {
      result.push(entry);
      continue;
    }
    const existingPosition = positionByKey.get(key);
    if (existingPosition === undefined) {
      positionByKey.set(key, result.length);
      if (entry.timestamp) {
        placementByKey.set(key, { timestamp: entry.timestamp, rank: rankOf(entry) });
      }
      result.push(entry);
      continue;
    }

    const held = placementByKey.get(key);
    const candidate = entry.timestamp;
    const candidateRank = rankOf(entry);
    let preservedTimestamp = candidate;
    if (held && candidate) {
      const keepCandidate = candidateRank > held.rank
        || (candidateRank === held.rank && candidate < held.timestamp);
      preservedTimestamp = keepCandidate ? candidate : held.timestamp;
      placementByKey.set(key, {
        timestamp: preservedTimestamp,
        rank: Math.max(candidateRank, held.rank),
      });
    } else if (held) {
      preservedTimestamp = held.timestamp;
    } else if (candidate) {
      placementByKey.set(key, { timestamp: candidate, rank: candidateRank });
    }
    result[existingPosition] = { ...entry, timestamp: preservedTimestamp };
  }
  return result;
}

const BRIDGE_TYPES: ReadonlySet<WorkerEntryType> = new Set<WorkerEntryType>([
  "message",
  "thought",
  "tool_call",
  "tool_call_update",
  "permission",
  "elicitation",
  "user_message_chunk",
  "plan",
  "plan_update",
  "plan_removed",
  "available_commands",
  "current_mode",
  "config_option",
  "session_info",
  "usage",
  "agent_content",
  "user_content",
]);

const SERVER_TYPES: ReadonlySet<WorkerEntryType> = new Set<WorkerEntryType>([
  "user_input",
  "supervisor_input",
  "system_note",
  "lifecycle",
]);

export function isBridgeOutputEntry(entry: WorkerEntry): boolean {
  return BRIDGE_TYPES.has(entry.type);
}

export function isServerProducedEntry(entry: WorkerEntry): boolean {
  return SERVER_TYPES.has(entry.type);
}

// ---------------------------------------------------------------------------
// Inline image content.
//
// An `agent_content`/`user_content` entry can carry a whole image as base64 in
// `raw.content.data`. Those bytes are conversation content, not disposable
// runtime diagnostics, and the worker stream is their only durable home — so
// the generic raw-string truncators must leave them intact, exactly as
// `toLiveEntry` already exempts assistant message text. Truncating them
// instead produced a stream whose images could never be decoded again.
//
// The payload is still bounded, just far above a realistic screenshot. The cap
// is expressed in base64 characters and sized to match the 25 MB decoded ceiling
// enforced on the read side by `src/server/workers/entry-content.ts`.
// ---------------------------------------------------------------------------

/** 25 MB of decoded bytes, expressed as base64 characters (4 chars per 3 bytes). */
export const IMAGE_CONTENT_DATA_CHARS = Math.ceil((25 * 1024 * 1024) / 3) * 4;

const IMAGE_CONTENT_TYPES: ReadonlySet<WorkerEntryType> = new Set<WorkerEntryType>([
  "agent_content",
  "user_content",
]);

/** Pointer the client resolves through `GET /api/workers/:id/entries?contentEntryId=`. */
export type WorkerEntryContentPointer = {
  workerId: string;
  entryId: string;
};

function asContentRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * The inline base64 image payload on this entry's raw notification, or null
 * when the entry does not carry one.
 */
export function inlineImageContentData(
  entryType: WorkerEntryType | string | undefined,
  raw: unknown,
): string | null {
  if (!IMAGE_CONTENT_TYPES.has(entryType as WorkerEntryType)) {
    return null;
  }
  const content = asContentRecord(asContentRecord(raw)?.content);
  if (content?.type !== "image" || typeof content.data !== "string") {
    return null;
  }
  return content.data;
}

/**
 * Re-attach the untruncated image payload to an already-compacted `raw`.
 *
 * Compaction stays generic — it still walks and bounds every other string in
 * the notification — and this restores only the one field the transcript
 * cannot regenerate. Payloads past the cap keep whatever the compactor
 * produced, so the read side reports them as unavailable rather than handing
 * back a corrupt image.
 */
export function preserveInlineImageContentData(
  entryType: WorkerEntryType | string | undefined,
  originalRaw: unknown,
  compactedRaw: unknown,
): unknown {
  const data = inlineImageContentData(entryType, originalRaw);
  if (data === null || data.length > IMAGE_CONTENT_DATA_CHARS) {
    return compactedRaw;
  }
  const compacted = asContentRecord(compactedRaw);
  const content = asContentRecord(compacted?.content);
  if (!compacted || !content) {
    return compactedRaw;
  }
  return { ...compacted, content: { ...content, data } };
}

/**
 * Swap an inline image payload for a content pointer before the entry crosses
 * the HTTP boundary.
 *
 * The stream stores whole images; sending them inline would put megabytes of
 * base64 into every transcript page. The client fetches the bytes once, on
 * demand, from the dedicated content route instead.
 */
export function elideInlineImageContentData<T extends { id: string; type: string; raw?: unknown }>(
  entry: T,
  workerId: string,
): T {
  if (inlineImageContentData(entry.type, entry.raw) === null) {
    return entry;
  }
  const raw = asContentRecord(entry.raw);
  const content = asContentRecord(raw?.content);
  if (!raw || !content) {
    return entry;
  }
  const pointer: WorkerEntryContentPointer = { workerId, entryId: entry.id };
  const nextContent: Record<string, unknown> = { ...content, omniWorkerContent: pointer };
  delete nextContent.data;
  return {
    ...entry,
    raw: { ...raw, content: nextContent },
  };
}
