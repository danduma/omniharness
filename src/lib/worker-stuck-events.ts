export interface WorkerStatusEvent {
  eventType: string;
  workerId?: string | null;
  createdAt?: string | Date | number | null;
}

const STUCK_RESOLVING_EVENT_TYPES = new Set([
  "worker_output_changed",
  "worker_turn_completed",
  "worker_stopped",
  "worker_cancelled",
  "worker_error",
  "worker_session_missing",
]);

const RUN_TERMINAL_EVENT_TYPES = new Set([
  "run_completed",
  "run_failed",
]);

function eventTimeMs(event: WorkerStatusEvent) {
  if (event.createdAt instanceof Date) {
    return event.createdAt.getTime();
  }

  if (typeof event.createdAt === "number") {
    return event.createdAt;
  }

  if (typeof event.createdAt === "string") {
    return new Date(event.createdAt).getTime();
  }

  return Number.NaN;
}

function workerKey(event: WorkerStatusEvent) {
  return typeof event.workerId === "string" && event.workerId.trim()
    ? event.workerId
    : null;
}

export function filterResolvedWorkerStuckEvents<T extends WorkerStatusEvent>(events: readonly T[]): T[] {
  const latestResolvingEventByWorker = new Map<string, number>();
  let latestTerminalRunEventMs = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const timeMs = eventTimeMs(event);
    if (Number.isFinite(timeMs) && RUN_TERMINAL_EVENT_TYPES.has(event.eventType)) {
      latestTerminalRunEventMs = Math.max(latestTerminalRunEventMs, timeMs);
    }

    const worker = workerKey(event);
    if (!worker || !Number.isFinite(timeMs) || !STUCK_RESOLVING_EVENT_TYPES.has(event.eventType)) {
      continue;
    }

    latestResolvingEventByWorker.set(worker, Math.max(
      latestResolvingEventByWorker.get(worker) ?? Number.NEGATIVE_INFINITY,
      timeMs,
    ));
  }

  return events.filter((event) => {
    if (event.eventType !== "worker_stuck") {
      return true;
    }

    const worker = workerKey(event);
    const timeMs = eventTimeMs(event);
    if (!worker || !Number.isFinite(timeMs)) {
      return true;
    }

    if (latestTerminalRunEventMs > timeMs) {
      return false;
    }

    const latestResolvingEventMs = latestResolvingEventByWorker.get(worker);
    return latestResolvingEventMs === undefined || latestResolvingEventMs <= timeMs;
  });
}

export function getLatestUnresolvedWorkerStuckEvent<T extends WorkerStatusEvent>(events: readonly T[]): T | null {
  return filterResolvedWorkerStuckEvents(events)
    .slice()
    .sort((a, b) => eventTimeMs(b) - eventTimeMs(a))
    .find((event) => event.eventType === "worker_stuck") ?? null;
}
