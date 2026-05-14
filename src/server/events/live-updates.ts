type LiveUpdateListener = () => void;
type EventStreamWaitResult = {
  notified: boolean;
};

const listeners = new Set<LiveUpdateListener>();
let notificationVersion = 0;

export function notifyEventStreamSubscribers() {
  notificationVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function getEventStreamNotificationVersion() {
  return notificationVersion;
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
