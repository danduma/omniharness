import { emitNamedEvent } from "@/server/events/named-events";
import {
  classifyToolActivityWithSource,
  type AgentActivitySource,
  type StreamAgentActivity,
} from "@/shared/agent-activity";
import { isOpenHumanInputStatus, type WorkerEntry } from "@/shared/worker-entries";
import { shadowWorkerActivity } from "@/server/decisions/points/worker-activity";

/**
 * Derives a worker's stream-driven activity at the append boundary and
 * publishes `worker.activity` on each transition. Clients read the event
 * instead of diffing transcripts (lifecycle-observability rule 1).
 *
 * One event per append *batch*: the net transition from the activity before
 * the batch to the last classifiable entry in it. A recovery reconcile can
 * append hundreds of historic entries at once, and replaying every
 * intermediate tool call as a live transition would flood the ring buffer
 * with activity that is no longer happening.
 */

type ClassifiableEntry = Pick<WorkerEntry, "type" | "text" | "toolKind" | "status" | "seq">;

type Classified = { activity: StreamAgentActivity; source: AgentActivitySource };

/** Bounded so long-lived runners do not accumulate state for every worker ever seen. */
const MAX_TRACKED_WORKERS = 2_000;

const activityByWorker = new Map<string, { activity: StreamAgentActivity; seq: number }>();

function trackerKey(runId: string, workerId: string) {
  return `${runId}\u0000${workerId}`;
}

export function classifyEntryActivity(entry: ClassifiableEntry): Classified | null {
  switch (entry.type) {
    case "tool_call":
      return classifyToolActivityWithSource({ kind: entry.toolKind, title: entry.text })
        ?? { activity: "working", source: "tool_kind" };
    case "permission":
    case "elicitation":
      return isOpenHumanInputStatus(entry.status)
        ? { activity: "waiting_user", source: "interaction" }
        : { activity: "working", source: "interaction" };
    case "user_input":
    case "supervisor_input":
    case "message":
    case "thought":
      return { activity: "working", source: "turn" };
    default:
      return null;
  }
}

export function observeWorkerActivity(
  runId: string,
  workerId: string,
  entries: ReadonlyArray<ClassifiableEntry>,
): void {
  // Decision layer (rollout B1/B2): compare the command classification and,
  // only if this point is allowed to act, refine the label once the answer
  // arrives. Fire-and-forget; the deterministic worker.activity below is
  // always emitted first.
  shadowWorkerActivity(runId, workerId, entries, refineWorkerActivity);

  let latest: (Classified & { seq: number }) | null = null;
  for (const entry of entries) {
    const classified = classifyEntryActivity(entry);
    if (classified && typeof entry.seq === "number" && Number.isFinite(entry.seq) && entry.seq > 0) {
      latest = { ...classified, seq: entry.seq };
    }
  }
  if (!latest) {
    return;
  }

  const key = trackerKey(runId, workerId);
  const prev = activityByWorker.get(key)?.activity ?? null;
  // Track the seq even when the activity is unchanged, so a late refinement
  // only applies to the entry that is actually current.
  remember(key, latest.activity, latest.seq);
  if (prev === latest.activity) {
    return;
  }

  emitNamedEvent({
    kind: "worker.activity",
    runId,
    workerId,
    activity: latest.activity,
    prev,
    source: latest.source,
    entrySeq: latest.seq,
  });
}

function remember(key: string, activity: StreamAgentActivity, seq: number) {
  // Re-insert so iteration order tracks recency for eviction.
  activityByWorker.delete(key);
  activityByWorker.set(key, { activity, seq });
  if (activityByWorker.size > MAX_TRACKED_WORKERS) {
    const oldest = activityByWorker.keys().next().value;
    if (oldest !== undefined) activityByWorker.delete(oldest);
  }
}

/**
 * Apply a decision-layer correction to the activity derived from `entrySeq`.
 * Refused (returns false) unless that entry is still the worker's current
 * activity, so a slow answer can never overwrite newer work.
 */
export function refineWorkerActivity(
  runId: string,
  workerId: string,
  entrySeq: number,
  activity: StreamAgentActivity,
): boolean {
  const key = trackerKey(runId, workerId);
  const current = activityByWorker.get(key);
  if (!current || current.seq !== entrySeq || current.activity === activity) {
    return false;
  }
  remember(key, activity, entrySeq);
  emitNamedEvent({
    kind: "worker.activity",
    runId,
    workerId,
    activity,
    prev: current.activity,
    source: "decision_model",
    entrySeq,
  });
  return true;
}

export function __resetWorkerActivityForTests() {
  activityByWorker.clear();
}
