type LiveUpdateListener = () => void;

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
  return new Promise<void>((resolve) => {
    if (notificationVersion > afterVersion) {
      resolve();
      return;
    }

    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      listeners.delete(listener);
      resolve();
    };

    const listener = () => cleanup();
    listeners.add(listener);
    timeout = setTimeout(cleanup, timeoutMs);
  });
}
