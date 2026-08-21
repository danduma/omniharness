import type { RuntimeApiError, RuntimeSubscription } from "./types";
import { GOAL_PUBLISHED_EVENT_KINDS } from "@/shared/goal-plan";

export type RuntimeStreamEvent = {
  type: string;
  data: string;
  lastEventId?: string;
};

export type RuntimeStreamHandlers = {
  onOpen?(): void;
  onEvent(event: unknown): void;
  onError?(error: RuntimeApiError): void;
};

export type RuntimeEventStreamOpener = (
  path: string,
  input: {
    lastEventId?: string | null;
  },
  handlers: RuntimeStreamHandlers,
) => RuntimeSubscription;

export const GOAL_SNAPSHOT_EVENT_TYPES = GOAL_PUBLISHED_EVENT_KINDS;

function isGoalSnapshotEventType(type: string) {
  return (GOAL_SNAPSHOT_EVENT_TYPES as readonly string[]).includes(type);
}

export function parseRuntimeStreamData(event: RuntimeStreamEvent) {
  if (!event.data) {
    return null;
  }
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return event.data;
  }
}

export function normalizeRuntimeStreamEvent(event: RuntimeStreamEvent) {
  const data = parseRuntimeStreamData(event);
  if (event.type === "update") {
    return { kind: "update", payload: data, lastEventId: event.lastEventId ?? null };
  }
  if (event.type === "stream.resync_required") {
    return {
      kind: "stream.resync_required",
      ...(data && typeof data === "object" ? data : { payload: data }),
    };
  }
  if (
    event.type === "data"
    || event.type === "exit"
    || event.type === "terminal.resync_required"
    || event.type === "update_error"
    || event.type === "worker.entry_appended"
    || event.type === "worker.plan_updated"
    || event.type === "worker.plan_boundary_started"
    || isGoalSnapshotEventType(event.type)
  ) {
    return {
      kind: event.type,
      payload: data,
      lastEventId: event.lastEventId ?? null,
    };
  }
  return data;
}
