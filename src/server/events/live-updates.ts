type LiveUpdateListener = () => void;
type EventStreamWaitResult = {
  notified: boolean;
};

const listeners = new Set<LiveUpdateListener>();
let notificationVersion = 0;
let snapshotVersion = 0;

/**
 * Wake the SSE streams.
 *
 * `snapshotRelevant: false` means "this change is fully described by the named
 * event frame itself; the client does not need a rebuilt snapshot to learn
 * about it". Worker transcript appends are the motivating case: content
 * reaches the client through `GET /api/workers/:id/entries`, driven by the
 * `worker.entry_appended` wake-up frame. Forcing a full snapshot rebuild for
 * every appended entry meant one streamed token cost every connected client a
 * ~40-query rebuild and a multi-hundred-KB payload, which is what made the UI
 * unusable once several sessions streamed at once.
 *
 * Delta-only wakes still bump `notificationVersion`, so parked streams wake
 * promptly and flush their cheap named frames. They just do not force the
 * expensive rebuild onto the critical path.
 */
export function notifyEventStreamSubscribers(options?: { snapshotRelevant?: boolean }) {
  notificationVersion += 1;
  if (options?.snapshotRelevant !== false) {
    snapshotVersion += 1;
  }
  for (const listener of listeners) {
    listener();
  }
}

export function getEventStreamNotificationVersion() {
  return notificationVersion;
}

/**
 * Advances only for changes that a client cannot learn about from a named
 * event frame alone. The SSE loop uses this to decide whether a wake-up
 * justifies rebuilding the snapshot.
 */
export function getEventStreamSnapshotVersion() {
  return snapshotVersion;
}

export function waitForEventStreamNotification(timeoutMs: number, afterVersion = notificationVersion) {
  return new Promise<EventStreamWaitResult>((resolve) => {
    if (notificationVersion > afterVersion) {
      resolve({ notified: true });
      return;
    }

    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (result: EventStreamWaitResult) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      listeners.delete(listener);
      resolve(result);
    };

    const listener = () => cleanup({ notified: true });
    listeners.add(listener);
    timeout = setTimeout(() => cleanup({ notified: false }), timeoutMs);
  });
}
