import type { WorkerEntry } from "@/shared/worker-entries";

export const MAX_ACP_PLAN_ITEMS = 100;
export const MAX_ACP_PLAN_ITEM_CODE_POINTS = 500;
export const MAX_ACP_PLAN_BYTES = 64 * 1024;
export const MAX_ACP_PLAN_REJECTION_PREVIEW_BYTES = 4 * 1024;
export const MAX_ACP_PLAN_SESSION_ID_BYTES = 1024;

export type AcpPlanItemStatus = "pending" | "in_progress" | "completed";
export type AcpPlanPriority = "high" | "medium" | "low";

export type AcpPlanItem = {
  id: string;
  content: string;
  priority: AcpPlanPriority;
  status: AcpPlanItemStatus;
  order: number;
};

export type AcpCorePlanEntry = {
  content: string;
  priority: AcpPlanPriority;
  status: AcpPlanItemStatus;
};

export type AcpCorePlanUpdate = {
  sessionUpdate: "plan";
  entries: AcpCorePlanEntry[];
};

export type WorkerPlanSnapshot = {
  runId: string;
  workerId: string;
  acpSessionId: string;
  planBoundarySeq: number;
  lastEntrySeq: number;
  lastAcceptedEntryId: string | null;
  visible: boolean;
  items: AcpPlanItem[];
  updatedAt: string;
};

export type WorkerPlanScope = {
  complete: boolean;
  runId: string;
  workerIds: string[];
  plansByWorkerId: Record<string, WorkerPlanSnapshot>;
};

export type WorkerPlanReadResponse = {
  plan: WorkerPlanSnapshot | null;
  latestSeq: number;
};

export type PlanSurfaceOwner = {
  runId: string | null;
  workerId: string | null;
  ready: boolean;
  ownsWidget: boolean;
  suppressAcceptedPlanRows: boolean;
  plan: WorkerPlanSnapshot | null;
};

export type AcpPlanValidationFailure = {
  ok: false;
  reason:
    | "malformed"
    | "too_many_items"
    | "item_not_object"
    | "empty_content"
    | "item_too_long"
    | "invalid_priority"
    | "invalid_status"
    | "update_too_large";
  itemIndex?: number;
  measuredBytes?: number;
};

export type AcpPlanValidationResult =
  | { ok: true; items: AcpPlanItem[] }
  | AcpPlanValidationFailure;

const priorities: ReadonlySet<string> = new Set(["high", "medium", "low"]);
const statuses: ReadonlySet<string> = new Set(["pending", "in_progress", "completed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function isAcpCorePlanUpdate(value: unknown): value is AcpCorePlanUpdate {
  return isRecord(value) && value.sessionUpdate === "plan" && Array.isArray(value.entries);
}

export function normalizeAcpCorePlan(value: unknown): AcpPlanValidationResult {
  if (!isAcpCorePlanUpdate(value)) {
    return { ok: false, reason: "malformed" };
  }

  const measuredBytes = jsonByteLength(value);
  if (measuredBytes > MAX_ACP_PLAN_BYTES) {
    return { ok: false, reason: "update_too_large", measuredBytes };
  }

  if (value.entries.length > MAX_ACP_PLAN_ITEMS) {
    return { ok: false, reason: "too_many_items", measuredBytes };
  }

  const items: AcpPlanItem[] = [];
  for (const [order, candidate] of value.entries.entries()) {
    if (!isRecord(candidate)) {
      return { ok: false, reason: "item_not_object", itemIndex: order };
    }

    const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
    if (!content) {
      return { ok: false, reason: "empty_content", itemIndex: order };
    }
    if (Array.from(content).length > MAX_ACP_PLAN_ITEM_CODE_POINTS) {
      return { ok: false, reason: "item_too_long", itemIndex: order };
    }

    const priority = candidate.priority;
    if (typeof priority !== "string" || !priorities.has(priority)) {
      return { ok: false, reason: "invalid_priority", itemIndex: order };
    }
    const status = candidate.status;
    if (typeof status !== "string" || !statuses.has(status)) {
      return { ok: false, reason: "invalid_status", itemIndex: order };
    }

    items.push({
      id: String(order),
      content,
      priority: priority as AcpPlanPriority,
      status: status as AcpPlanItemStatus,
      order,
    });
  }

  return { ok: true, items };
}

export function measureAcpPlanJsonBytes(value: unknown): number {
  return jsonByteLength(value);
}

function entrySeq(entry: WorkerEntry): number {
  return Number.isFinite(entry.seq) && entry.seq > 0 ? entry.seq : 0;
}

export function reduceWorkerPlanEntries(
  entries: readonly WorkerEntry[],
  runId: string,
  workerId: string,
): WorkerPlanSnapshot | null {
  const ordered = [...entries].sort((a, b) => entrySeq(a) - entrySeq(b));
  const boundary = ordered.reduce<WorkerEntry | null>((latest, entry) => {
    if (entry.planProjection !== "session_reset" || !entry.acpSessionId) return latest;
    return !latest || entrySeq(entry) > entrySeq(latest) ? entry : latest;
  }, null);

  if (!boundary || !boundary.acpSessionId) {
    return null;
  }

  const accepted = ordered.reduce<WorkerEntry | null>((latest, entry) => {
    // Legacy plan-shaped rows are diagnostic history only. Projection is an
    // explicit ingress decision; replay must never infer acceptance from a
    // `type: "plan"` row or from the shape of its raw payload.
    if (
      entry.planProjection !== "accepted_core"
      || entry.acpSessionId !== boundary.acpSessionId
      || entrySeq(entry) <= entrySeq(boundary)
      || !Array.isArray(entry.normalizedPlan)
    ) {
      return latest;
    }
    return !latest || entrySeq(entry) > entrySeq(latest) ? entry : latest;
  }, null);

  const source = accepted ?? boundary;
  return {
    runId,
    workerId,
    acpSessionId: boundary.acpSessionId,
    planBoundarySeq: entrySeq(boundary),
    lastEntrySeq: entrySeq(source),
    lastAcceptedEntryId: accepted?.id ?? null,
    visible: Boolean(accepted),
    items: accepted?.normalizedPlan
      ? accepted.normalizedPlan.map((item, order) => ({
          ...item,
          id: `${entrySeq(boundary)}:${order}`,
          order,
        }))
      : [],
    updatedAt: source.timestamp,
  };
}
