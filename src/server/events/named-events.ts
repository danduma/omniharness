/**
 * Named lifecycle events emitted alongside the snapshot stream.
 *
 * See docs/architecture/lifecycle-observability-and-testing.md for the
 * design rationale. The short version:
 *
 *   - Every server-side decision that the user, the UI, or a test client
 *     might want to observe is published here as a typed event.
 *   - Events share a single monotonic id namespace with the `update`
 *     snapshot frames emitted by /api/events. That keeps SSE
 *     `Last-Event-ID` resume unambiguous.
 *   - A bounded ring buffer remembers recent emissions so reconnecting
 *     clients can replay events they missed during disconnect.
 *
 * This module is intentionally synchronous and in-process. The ring
 * resets when the server restarts; clients then bootstrap via
 * `/api/events?snapshot=1` and resume from the new cursor.
 */
import { notifyEventStreamSubscribers } from "./live-updates";

// ---------------------------------------------------------------------------
// Event union
// ---------------------------------------------------------------------------

export type SurfacedErrorCode =
  | "plan.review.leftover_state"
  | "plan.review.failed"
  | "conversation.delete.foreign_key"
  | "conversation.delete.failed"
  | "process.spawn.failed"
  | "process.cwd.invalid"
  | "process.stdin.closed"
  | "process.stop.failed"
  | "process.orphaned_after_restart"
  | "recovery.gave_up"
  | "runtime.start_failed"
  | "session.provider.unknown"
  | "session.action.unsupported"
  | "surface.bridge_failed"
  | "worker.spawn.failed"
  | "worker.failover.failed"
  | "codex_auth_missing"
  | "codex_auth_refresh_failed"
  | "codex_auth_unavailable"
  | "internal";

export type FailoverStage = "selection" | "handoff" | "spawn";
export type HandoffSource = "worker" | "synthetic";

export type ErrorSurface = "toast" | "banner" | "log";

export type RuntimeSurface = "web" | "electron" | "vscode" | "cli" | "test";

export type RuntimeStopReason =
  | "shutdown"
  | "test_complete"
  | "restart"
  | "surface_closed"
  | "error";

export type RuntimeEvent =
  | {
      kind: "runtime.started";
      surface: RuntimeSurface;
      label: string;
      startedAt: string;
    }
  | {
      kind: "runtime.start_failed";
      surface: RuntimeSurface;
      label: string;
      reason: string;
    }
  | {
      kind: "runtime.stopped";
      surface: RuntimeSurface;
      reason: RuntimeStopReason;
    }
  | {
      kind: "surface.connected";
      surface: RuntimeSurface;
      label: string;
    }
  | {
      kind: "surface.disconnected";
      surface: RuntimeSurface;
      reason: string;
    }
  | {
      kind: "surface.bridge_failed";
      surface: RuntimeSurface;
      reason: string;
    };

export type WorkerEvent =
  | { kind: "worker.spawned"; runId: string; workerId: string; workerType: string }
  | { kind: "worker.status"; runId: string; workerId: string; prev: string; next: string }
  | { kind: "worker.terminal"; runId: string; workerId: string; status: string }
  | { kind: "worker.reattached"; runId: string; workerId: string }
  | { kind: "worker.recreated"; runId: string; workerId: string }
  // Wake-up frame for the unified worker conversation stream. Carries
  // only (workerId, seq); clients fetch the entry via
  // GET /api/workers/:workerId/entries?afterSeq=. See
  // docs/architecture/worker-conversation-stream.md.
  | { kind: "worker.entry_appended"; runId: string; workerId: string; seq: number }
  | {
      kind: "worker.failover_started";
      runId: string;
      outgoingWorkerId: string;
      outgoingType: string;
      reason: string;
    }
  | {
      kind: "worker.handoff_emitted";
      runId: string;
      outgoingWorkerId: string;
      source: HandoffSource;
    }
  | {
      kind: "worker.failover_completed";
      runId: string;
      outgoingWorkerId: string;
      newWorkerId: string;
      newType: string;
    }
  | {
      kind: "worker.failover_failed";
      runId: string;
      outgoingWorkerId: string;
      stage: FailoverStage;
      reason: string;
    };

export type SupervisorStopReason =
  | "run_terminated"
  | "run_failed"
  | "cwd_mismatch"
  | "snapshot_invalid"
  | "quota_exhausted"
  | "fatal_bridge_error"
  | "explicit";

export type SupervisorEvent =
  | { kind: "supervisor.stopped"; runId: string; reason: SupervisorStopReason }
  | {
      kind: "supervisor.wake_skipped";
      runId: string;
      reason: "in_flight" | "lease_blocked" | "quota_wait_future_wake" | "run_not_runnable";
    }
  | { kind: "supervisor.wake_scheduled"; runId: string; delayMs: number; source: "volatile" | "lease_retry" }
  | { kind: "supervisor.durable_wake_claimed"; runId: string; reason: string; source: string | null };

export type PlanEvent =
  | { kind: "plan.ready"; runId: string; planId: string | null }
  | { kind: "plan.review.started"; runId: string; reviewRunId: string }
  | { kind: "plan.review.finished"; runId: string; reviewRunId: string; status: string }
  | { kind: "plan.review.blocked"; runId: string; reason: string };

export type RecoveryEvent =
  | { kind: "recovery.opened"; runId: string; incidentId: string; recoveryKind: string }
  | { kind: "recovery.attempt"; runId: string; incidentId: string; attempt: number }
  | { kind: "recovery.gave_up"; runId: string; incidentId: string; attempts: number }
  | { kind: "recovery.resolved"; runId: string; incidentId: string };

export type ConversationEvent =
  | { kind: "conversation.awaiting_user"; runId: string; workerId?: string; reason: "worker_requested_input" }
  | { kind: "conversation.read"; runId: string; lastReadAt: string }
  | { kind: "conversation.deleted"; runId: string }
  | { kind: "conversation.delete_failed"; runId: string; blockingTable: string | null };

export type SessionEvent =
  | { kind: "session.created"; runId: string; sessionType: string; actorIds: string[] }
  | { kind: "session.starting"; runId: string; sessionType: string }
  | { kind: "session.status"; runId: string; sessionType: string; prev: string | null; next: string; reason?: string }
  | { kind: "session.input.accepted"; runId: string; targetActorId: string; inputId: string }
  | { kind: "session.input.delivered"; runId: string; targetActorId: string; inputId: string }
  | { kind: "session.input.refused"; runId: string; sessionType: string; code: string; reason: string }
  | { kind: "session.action.refused"; runId: string; sessionType: string; action: string; code: string; reason: string }
  | { kind: "session.stopped"; runId: string; sessionType: string; reason: string }
  | { kind: "process.spawned"; runId: string; workerId: string; pid: number; commandPreview: string }
  | { kind: "process.exited"; runId: string; workerId: string; exitCode: number | null; signal: string | null };

export type ErrorSurfacedEvent = {
  kind: "error.surfaced";
  code: SurfacedErrorCode;
  message: string;
  surface: ErrorSurface;
  runId?: string;
  workerId?: string;
  conversationId?: string;
  cause?: { name: string; message: string } | null;
};

export type StreamControlEvent = {
  kind: "stream.resync_required";
  reason: "id_out_of_buffer" | "buffer_reset";
};

export type NamedEvent =
  | RuntimeEvent
  | WorkerEvent
  | SupervisorEvent
  | PlanEvent
  | RecoveryEvent
  | ConversationEvent
  | SessionEvent
  | ErrorSurfacedEvent
  | StreamControlEvent;

// Internal: snapshot marker stored in the ring so `Last-Event-ID` resume
// from immediately after a snapshot remains resolvable. The marker itself
// is not emitted as a named SSE frame — it just reserves an id and lets
// the route render a fresh snapshot on replay.
export type SnapshotMarker = {
  kind: "snapshot.marker";
  version: number;
};

export type BufferedEntry =
  | { id: number; emittedAt: number; runId: string | null; event: NamedEvent }
  | { id: number; emittedAt: number; runId: string | null; event: SnapshotMarker };

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

const RING_CAPACITY = 500;
let cursor = 0;
const ring: BufferedEntry[] = [];

function pickRunId(event: NamedEvent | SnapshotMarker): string | null {
  if ("runId" in event && typeof event.runId === "string") {
    return event.runId;
  }
  return null;
}

function append(event: NamedEvent | SnapshotMarker, runIdOverride?: string | null): BufferedEntry {
  cursor += 1;
  const entry = {
    id: cursor,
    emittedAt: Date.now(),
    runId: runIdOverride ?? pickRunId(event),
    event,
  } as BufferedEntry;
  ring.push(entry);
  if (ring.length > RING_CAPACITY) {
    ring.shift();
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Public emit API
// ---------------------------------------------------------------------------

/**
 * Emit a named lifecycle event. Records the event in the ring buffer
 * and signals the SSE stream to wake up so subscribed clients receive
 * the frame promptly.
 */
export function emitNamedEvent(event: NamedEvent): BufferedEntry {
  const entry = append(event);
  notifyEventStreamSubscribers();
  return entry;
}

/**
 * Reserve a ring-buffer id for an upcoming `update` snapshot frame.
 * The marker itself carries no data the client renders — its only
 * purpose is to keep the id sequence contiguous so `Last-Event-ID`
 * resume after a snapshot frame can be resolved from the ring buffer.
 *
 * Note: this does NOT notify subscribers; the caller is mid-stream and
 * will write the snapshot frame itself.
 */
export function recordSnapshotMarker(
  version: number,
  runId: string | null = null,
): BufferedEntry {
  return append({ kind: "snapshot.marker", version }, runId);
}

// ---------------------------------------------------------------------------
// Resume / replay
// ---------------------------------------------------------------------------

export type ReplayResult = {
  /** True iff the requested `lastEventId` has fallen out of the ring
   * buffer; the client should re-bootstrap via /api/events?snapshot=1. */
  resyncRequired: boolean;
  /** Events strictly newer than `lastEventId`, in id order, filtered to
   * the given runId scope when provided. Snapshot markers are excluded
   * from the returned list — the SSE route renders them as fresh
   * snapshots inline rather than replaying their stored form. */
  events: BufferedEntry[];
  /** Current cursor at the time of the call. Clients should resume
   * from this id on the next call after consuming the events. */
  lastEventId: number;
};

export type ReplayOptions = {
  /** Filter to events scoped to this runId or unscoped (runId=null in
   * the buffer). Pass null/undefined to receive all events. */
  runId?: string | null;
  /** Include snapshot markers in the returned events. The SSE route
   * uses this internally; the dev log endpoint does not. */
  includeSnapshotMarkers?: boolean;
};

export function getEventCursor(): number {
  return cursor;
}

export function getNamedEventsSince(
  lastEventId: number | null,
  options: ReplayOptions = {},
): ReplayResult {
  const includeMarkers = options.includeSnapshotMarkers === true;
  const runIdFilter = options.runId ?? null;

  // A client carrying a `lastEventId` greater than our current cursor
  // means the server cursor was reset under their feet (process
  // restart, ring purge, or simply a client that lied). Either way, we
  // cannot replay backwards from a position we never reached — tell
  // them to resync from /api/events?snapshot=1.
  if (lastEventId !== null && lastEventId > cursor) {
    return { resyncRequired: true, events: [], lastEventId: cursor };
  }

  if (ring.length === 0) {
    return { resyncRequired: false, events: [], lastEventId: cursor };
  }

  const oldest = ring[0]!.id;
  // A client passing `lastEventId` strictly less than (oldest - 1) has
  // missed at least one event we no longer hold. Tell them to resync.
  // The off-by-one (oldest - 1) is intentional: if the client's last id
  // equals (oldest - 1), the very next event in the buffer is the one
  // they need, which is fine.
  if (lastEventId !== null && lastEventId < oldest - 1) {
    return { resyncRequired: true, events: [], lastEventId: cursor };
  }

  const events = ring.filter((entry) => {
    if (lastEventId !== null && entry.id <= lastEventId) {
      return false;
    }
    if (!includeMarkers && entry.event.kind === "snapshot.marker") {
      return false;
    }
    if (runIdFilter !== null && entry.runId !== null && entry.runId !== runIdFilter) {
      return false;
    }
    return true;
  });

  return { resyncRequired: false, events, lastEventId: cursor };
}

// ---------------------------------------------------------------------------
// Test hooks
// ---------------------------------------------------------------------------

/** @internal — vitest only */
export function __resetNamedEventsForTests() {
  cursor = 0;
  ring.length = 0;
}

/** @internal — vitest only */
export function __getRingForTests(): readonly BufferedEntry[] {
  return ring;
}

/** @internal — vitest only */
export function __getRingCapacity() {
  return RING_CAPACITY;
}
