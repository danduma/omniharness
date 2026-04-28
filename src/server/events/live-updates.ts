type LiveUpdateListener = () => void;

const listeners = new Set<LiveUpdateListener>();

export function notifyEventStreamSubscribers() {
  for (const listener of listeners) {
    listener();
  }
}

export function waitForEventStreamNotification(timeoutMs: number) {
  return new Promise<void>((resolve) => {
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
