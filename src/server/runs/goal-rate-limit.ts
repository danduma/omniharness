interface GoalRateLimitEntry {
  count: number;
  windowStartedAt: number;
  lastSeenAt: number;
}

export class GoalRateLimitManager {
  private readonly entries = new Map<string, GoalRateLimitEntry>();

  constructor(
    private readonly options: { limit?: number; windowMs?: number; maxEntries?: number } = {},
  ) {}

  check(input: { principalId: string; runId: string; endpoint: string; now?: number }) {
    const now = input.now ?? Date.now();
    const limit = this.options.limit ?? 60;
    const windowMs = this.options.windowMs ?? 60_000;
    const key = `${input.principalId}\0${input.runId}\0${input.endpoint}`;
    const current = this.entries.get(key);
    const entry = !current || now - current.windowStartedAt >= windowMs
      ? { count: 0, windowStartedAt: now, lastSeenAt: now }
      : current;
    entry.count += 1;
    entry.lastSeenAt = now;
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.prune();
    return entry.count <= limit
      ? { allowed: true as const, remaining: Math.max(0, limit - entry.count) }
      : { allowed: false as const, retryAfterMs: Math.max(1, windowMs - (now - entry.windowStartedAt)) };
  }

  private prune() {
    const maxEntries = this.options.maxEntries ?? 512;
    while (this.entries.size > maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (typeof oldest !== "string") break;
      this.entries.delete(oldest);
    }
  }
}

export const goalRateLimitManager = new GoalRateLimitManager();
