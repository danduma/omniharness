import type { WorkerEntry } from "@/server/workers/entries-types";

export type PendingWorkerElicitation = {
  requestId: number;
  requestedAt: string;
  sessionId?: string | null;
  toolCallId?: string | null;
  message?: string | null;
  requestedSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  } | null;
};

const TERMINAL_ELICITATION_STATUSES = new Set([
  "answered",
  "cancelled",
  "canceled",
  "completed",
  "declined",
  "failed",
  "rejected",
  "skipped",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRequestedSchema(value: unknown): PendingWorkerElicitation["requestedSchema"] {
  const schema = asRecord(value);
  if (!schema) {
    return null;
  }
  const properties = asRecord(schema.properties) ?? {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : undefined;
  const type = asString(schema.type);
  return {
    properties,
    ...(type ? { type } : {}),
    ...(required ? { required } : {}),
  };
}

function normalizeElicitationStatus(entry: WorkerEntry) {
  return (entry.status ?? "pending").trim().toLowerCase();
}

function isOpenElicitationStatus(entry: WorkerEntry) {
  return !TERMINAL_ELICITATION_STATUSES.has(normalizeElicitationStatus(entry));
}

function entryRequestId(entry: WorkerEntry) {
  const raw = asRecord(entry.raw);
  const requestId = raw?.requestId;
  return typeof requestId === "number" && Number.isFinite(requestId) ? requestId : null;
}

function pendingFromEntry(entry: WorkerEntry): PendingWorkerElicitation | null {
  const raw = asRecord(entry.raw);
  const requestId = entryRequestId(entry);
  if (!raw || requestId === null || !isOpenElicitationStatus(entry)) {
    return null;
  }
  return {
    requestId,
    requestedAt: entry.timestamp,
    sessionId: asString(raw.sessionId),
    toolCallId: asString(raw.toolCallId ?? entry.toolCallId),
    message: asString(raw.message),
    requestedSchema: asRequestedSchema(raw.requestedSchema),
  };
}

export function derivePendingElicitationsFromWorkerEntries(entries: readonly WorkerEntry[]): PendingWorkerElicitation[] {
  const pendingByRequestId = new Map<number, PendingWorkerElicitation>();

  for (const entry of entries) {
    if (entry.type !== "elicitation") {
      continue;
    }
    const requestId = entryRequestId(entry);
    if (requestId === null) {
      continue;
    }
    if (!isOpenElicitationStatus(entry)) {
      pendingByRequestId.delete(requestId);
      continue;
    }
    const pending = pendingFromEntry(entry);
    if (pending) {
      pendingByRequestId.set(requestId, pending);
    }
  }

  return Array.from(pendingByRequestId.values()).sort((left, right) => {
    const timeDelta = new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime();
    return timeDelta || left.requestId - right.requestId;
  });
}
