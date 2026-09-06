import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isConcurrentAgentStartError,
  waitForConcurrentAgentStart,
} from "@/server/workers/runtime-agent-adoption";

describe("runtime agent adoption", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("recognizes both duplicate-spawn responses for the same worker", () => {
    expect(isConcurrentAgentStartError(
      new Error("Spawn failed: Agent already exists: worker-1"),
      "worker-1",
    )).toBe(true);
    expect(isConcurrentAgentStartError(
      new Error("Spawn failed: Agent is already starting: worker-1"),
      "worker-1",
    )).toBe(true);
    expect(isConcurrentAgentStartError(
      new Error("Spawn failed: Agent is already starting: worker-2"),
      "worker-1",
    )).toBe(false);
  });

  it("waits through registration lag and adopts the concurrent agent", async () => {
    vi.useFakeTimers();
    const agent = { name: "worker-1", state: "idle" };
    const getAgent = vi.fn()
      .mockRejectedValueOnce(new Error("Get agent failed: Agent not found: worker-1"))
      .mockResolvedValueOnce(agent);

    const adoption = waitForConcurrentAgentStart({
      workerId: "worker-1",
      getAgent,
      pollMs: 10,
      timeoutMs: 100,
    });
    await vi.advanceTimersByTimeAsync(10);

    await expect(adoption).resolves.toBe(agent);
    expect(getAgent).toHaveBeenCalledTimes(2);
  });

  it("stops polling when a newer worker turn takes ownership", async () => {
    vi.useFakeTimers();
    const getAgent = vi.fn().mockRejectedValue(new Error("Get agent failed: Agent not found: worker-1"));
    const assertCurrent = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Worker turn was superseded by a newer worker turn"));

    const adoption = waitForConcurrentAgentStart({
      workerId: "worker-1",
      getAgent,
      assertCurrent,
      pollMs: 10,
      timeoutMs: 100,
    });
    const rejected = expect(adoption).rejects.toThrow(/superseded/i);
    await vi.advanceTimersByTimeAsync(10);

    await rejected;
    expect(getAgent).toHaveBeenCalledTimes(1);
  });

  it("bounds a hanging runtime lookup by the overall deadline", async () => {
    vi.useFakeTimers();
    const adoption = waitForConcurrentAgentStart({
      workerId: "worker-1",
      getAgent: () => new Promise<never>(() => undefined),
      timeoutMs: 25,
    });
    const rejected = expect(adoption).rejects.toThrow("Worker recovery did not finish within 0.025 seconds.");
    await vi.advanceTimersByTimeAsync(25);

    await rejected;
  });
});
