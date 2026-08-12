import { describe, expect, it, vi } from "vitest";
import { AcpPlanManager } from "@/interface/home/AcpPlanManager";
import type { WorkerPlanReadResponse } from "@/shared/acp-plan";

function response(workerId: string, seq: number, content: string): WorkerPlanReadResponse {
  return {
    latestSeq: seq,
    plan: {
      runId: "run-1",
      workerId,
      acpSessionId: "session-1",
      planBoundarySeq: 1,
      lastEntrySeq: seq,
      lastAcceptedEntryId: `plan-${seq}`,
      visible: true,
      items: [{ id: "0", content, priority: "medium", status: "pending", order: 0 }],
      updatedAt: new Date(1700000000000 + seq).toISOString(),
    },
  };
}

function resetResponse(workerId: string, boundarySeq: number): WorkerPlanReadResponse {
  return {
    latestSeq: boundarySeq,
    plan: {
      runId: "run-1",
      workerId,
      acpSessionId: "session-2",
      planBoundarySeq: boundarySeq,
      lastEntrySeq: boundarySeq,
      lastAcceptedEntryId: null,
      visible: false,
      items: [],
      updatedAt: new Date(1700000000000 + boundarySeq).toISOString(),
    },
  };
}

describe("AcpPlanManager", () => {
  it("ignores a late response from an old run scope", async () => {
    const first = vi.fn<() => Promise<WorkerPlanReadResponse>>();
    let resolveFirst!: (value: WorkerPlanReadResponse) => void;
    first.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    const manager = new AcpPlanManager();
    manager.configure(first as never);

    manager.setScope("run-1", ["worker-1"]);
    manager.setScope("run-2", ["worker-2"]);
    resolveFirst(response("worker-1", 2, "old"));
    await Promise.resolve();

    expect(manager.getState().scope?.runId).toBe("run-2");
    expect(manager.getState().scope?.plansByWorkerId).toEqual({});
  });

  it("refreshes only when a wake-up advances the known plan cursor", async () => {
    const getPlan = vi.fn(async () => response("worker-1", 2, "next"));
    const manager = new AcpPlanManager();
    manager.configure(getPlan as never);
    manager.setScope("run-1", ["worker-1"]);
    await vi.waitFor(() => expect(manager.getState().scope?.plansByWorkerId["worker-1"]).toBeDefined());
    const callsAfterInitial = getPlan.mock.calls.length;

    manager.onWakeUp({ runId: "run-1", workerId: "worker-1", seq: 2 });
    await Promise.resolve();
    expect(getPlan).toHaveBeenCalledTimes(callsAfterInitial);

    manager.onWakeUp({ runId: "run-1", workerId: "worker-1", seq: 3 });
    await vi.waitFor(() => expect(getPlan.mock.calls.length).toBe(callsAfterInitial + 1));
  });

  it("becomes ready when an authoritative read says a worker is unbound", async () => {
    const manager = new AcpPlanManager();
    manager.configure(vi.fn(async () => ({ plan: null, latestSeq: 7 })) as never);

    manager.setScope("run-1", ["worker-1"]);

    await vi.waitFor(() => expect(manager.getState().status).toBe("ready"));
    expect(manager.getState().scope?.plansByWorkerId).toEqual({});
  });

  it("preserves known state for partial coverage and clears it only after complete coverage", async () => {
    const getPlan = vi.fn(async () => response("worker-1", 2, "known"));
    const manager = new AcpPlanManager();
    manager.configure(getPlan as never);
    manager.setScope("run-1", ["worker-1"], true);
    await vi.waitFor(() => expect(manager.getState().status).toBe("ready"));

    getPlan.mockResolvedValue({ plan: null, latestSeq: 3 });
    manager.setScope("run-1", ["worker-1"], false);
    await vi.waitFor(() => expect(manager.getState().status).toBe("ready"));
    expect(manager.getState().scope?.plansByWorkerId["worker-1"]).toBeDefined();

    manager.setScope("run-1", ["worker-1"], true);
    await vi.waitFor(() => expect(manager.getState().scope?.plansByWorkerId["worker-1"]).toBeUndefined());
  });

  it("preserves an equal-token plan with conflicting content and performs one resync read", async () => {
    const first = response("worker-1", 2, "known");
    const conflict = response("worker-1", 2, "conflict");
    const getPlan = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(conflict);
    const manager = new AcpPlanManager();
    manager.configure(getPlan as never);
    manager.setScope("run-1", ["worker-1"]);
    await vi.waitFor(() => expect(manager.getState().status).toBe("ready"));

    manager.onStreamResync();

    await vi.waitFor(() => expect(getPlan).toHaveBeenCalledTimes(3));
    expect(manager.getState().scope?.plansByWorkerId["worker-1"]?.items[0]?.content).toBe("known");
  });

  it("lets a newer wake-up overtake an in-flight plan read", async () => {
    let resolveInitial!: (value: WorkerPlanReadResponse) => void;
    const getPlan = vi.fn()
      .mockReturnValueOnce(new Promise<WorkerPlanReadResponse>((resolve) => { resolveInitial = resolve; }))
      .mockResolvedValueOnce(response("worker-1", 4, "newest"));
    const manager = new AcpPlanManager();
    manager.configure(getPlan as never);

    manager.setScope("run-1", ["worker-1"]);
    manager.onWakeUp({ runId: "run-1", workerId: "worker-1", seq: 4 });
    await vi.waitFor(() => expect(manager.getState().scope?.plansByWorkerId["worker-1"]?.items[0]?.content).toBe("newest"));

    resolveInitial(response("worker-1", 2, "stale"));
    await Promise.resolve();
    expect(manager.getState().scope?.plansByWorkerId["worker-1"]?.items[0]?.content).toBe("newest");
  });

  it("replaces a cached visible plan with a newer reset tombstone", async () => {
    const getPlan = vi.fn()
      .mockResolvedValueOnce(response("worker-1", 2, "cached"))
      .mockResolvedValueOnce(resetResponse("worker-1", 3));
    const manager = new AcpPlanManager();
    manager.configure(getPlan as never);
    manager.setScope("run-1", ["worker-1"]);
    await vi.waitFor(() => expect(manager.getState().status).toBe("ready"));

    manager.onWakeUp({ runId: "run-1", workerId: "worker-1", seq: 3 });
    await vi.waitFor(() => expect(manager.getState().scope?.plansByWorkerId["worker-1"]?.visible).toBe(false));
    expect(manager.getState().scope?.plansByWorkerId["worker-1"]?.planBoundarySeq).toBe(3);
  });

  it("drops deleted workers and their plan state from a complete scope", async () => {
    const manager = new AcpPlanManager();
    manager.configure(vi.fn(async () => response("worker-1", 2, "known")) as never);
    manager.setScope("run-1", ["worker-1"]);
    await vi.waitFor(() => expect(manager.getState().status).toBe("ready"));

    manager.setScope("run-1", [], true);

    expect(manager.getState()).toMatchObject({
      status: "ready",
      scope: { complete: true, workerIds: [], plansByWorkerId: {} },
    });
  });

  it("rejects a plan response whose embedded worker identity does not match the request", async () => {
    const manager = new AcpPlanManager();
    manager.configure(vi.fn(async () => response("worker-2", 2, "wrong worker")) as never);

    manager.setScope("run-1", ["worker-1"]);

    await vi.waitFor(() => expect(manager.getState().status).toBe("error"));
    expect(manager.getState().scope?.plansByWorkerId).toEqual({});
    expect(manager.getState().lastError).toContain("identity");
  });

  it("coalesces duplicate cursor wake-ups while the same plan read is in flight", async () => {
    let resolveWake!: (value: WorkerPlanReadResponse) => void;
    const getPlan = vi.fn()
      .mockResolvedValueOnce(response("worker-1", 2, "initial"))
      .mockReturnValueOnce(new Promise<WorkerPlanReadResponse>((resolve) => { resolveWake = resolve; }));
    const manager = new AcpPlanManager();
    manager.configure(getPlan as never);
    manager.setScope("run-1", ["worker-1"]);
    await vi.waitFor(() => expect(manager.getState().status).toBe("ready"));

    manager.onWakeUp({ runId: "run-1", workerId: "worker-1", seq: 3 });
    manager.onWakeUp({ runId: "run-1", workerId: "worker-1", seq: 3 });

    expect(getPlan).toHaveBeenCalledTimes(2);
    resolveWake(response("worker-1", 3, "next"));
    await vi.waitFor(() => expect(manager.getState().scope?.plansByWorkerId["worker-1"]?.lastEntrySeq).toBe(3));
  });
});
