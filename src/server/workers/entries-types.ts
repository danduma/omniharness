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
};

export type BridgeWorkerEntryType =
  | "message"
  | "thought"
  | "tool_call"
  | "tool_call_update"
  | "permission"
  | "elicitation";

export type ServerWorkerEntryType =
  | "user_input"
  | "supervisor_input"
  | "system_note"
  | "lifecycle";

export type WorkerEntryType = BridgeWorkerEntryType | ServerWorkerEntryType;

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
}

const BRIDGE_TYPES: ReadonlySet<WorkerEntryType> = new Set<WorkerEntryType>([
  "message",
  "thought",
  "tool_call",
  "tool_call_update",
  "permission",
  "elicitation",
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
