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
});
