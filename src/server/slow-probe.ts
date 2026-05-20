// Lightweight per-request timing for debugging slow API handlers.
// Output a single line at request end: `[slow-probe] <route> total=Xms a=Yms b=Zms ...`
// Only logs when total >= MIN_TOTAL_MS to keep the log clean.

const MIN_TOTAL_MS = (() => {
  const raw = process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS;
  if (!raw) return 100;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 100;
})();

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
      if (total < MIN_TOTAL_MS) return;
      const parts = segments.map(([label, ms]) => `${label}=${ms}ms`).join(" ");
      console.log(`[slow-probe] ${route} total=${total}ms ${parts}`);
    },
  };
}
