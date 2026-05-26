// Lightweight per-request timing for debugging slow API handlers.
// Output a single line at request end: `[slow-probe] <route> total=Xms a=Yms b=Zms ...`
// Only logs when total >= MIN_TOTAL_MS to keep the log clean.

function getMinTotalMs(): number {
  const raw = process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS;
  if (!raw) return 200;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 200;
}

export type SlowProbe = {
  mark: (label: string) => void;
  end: () => void;
};

export function startSlowProbe(route: string): SlowProbe {
  const start = Date.now();
  let prev = start;
  let ended = false;
  const segments: Array<[string, number]> = [];
  return {
    mark(label: string) {
      if (ended) return;
      const now = Date.now();
      segments.push([label, now - prev]);
      prev = now;
    },
    end() {
      if (ended) return;
      ended = true;
      const total = Date.now() - start;
      if (total < getMinTotalMs()) return;
      const parts = segments.map(([label, ms]) => `${label}=${ms}ms`).join(" ");
      console.log(`[slow-probe] ${route} total=${total}ms ${parts}`);
    },
  };
}

// Outer probe: times the full Next.js wrapper, including pre-handler queueing,
// middleware, and any work after the inner probe ends. Compare its `total` to
// the inner [slow-probe] total to see whether time is spent inside the
// handler or outside it (event-loop wait, transport, etc.).
export async function withOuterProbe<T>(
  label: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const arrived = Date.now();
  // Yield once so we measure the gap between arrival and the moment we
  // actually get CPU. If the event loop is starved, `started - arrived`
  // captures it.
  await Promise.resolve();
  const started = Date.now();
  try {
    return await fn();
  } finally {
    const now = Date.now();
    const total = now - arrived;
    if (total >= getMinTotalMs()) {
      const queued = started - arrived;
      const handler = now - started;
      console.log(
        `[outer-probe] ${label} total=${total}ms queued=${queued}ms handler=${handler}ms`,
      );
    }
  }
}
