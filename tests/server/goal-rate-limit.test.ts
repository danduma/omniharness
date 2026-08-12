import { describe, expect, it } from "vitest";
import { GoalRateLimitManager } from "@/server/runs/goal-rate-limit";

describe("GoalRateLimitManager", () => {
  it("bounds mutations per principal, run, endpoint, and time window", () => {
    const manager = new GoalRateLimitManager({ limit: 2, windowMs: 1_000 });
    const input = { principalId: "principal", runId: "run", endpoint: "put", now: 100 };
    expect(manager.check(input).allowed).toBe(true);
    expect(manager.check(input).allowed).toBe(true);
    expect(manager.check(input)).toMatchObject({ allowed: false, retryAfterMs: 1_000 });
    expect(manager.check({ ...input, runId: "other" }).allowed).toBe(true);
    expect(manager.check({ ...input, now: 1_100 }).allowed).toBe(true);
  });
});
