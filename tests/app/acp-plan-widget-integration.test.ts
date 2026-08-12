import { describe, expect, it } from "vitest";
import { selectAcpPlanSurfaceOwner, type AcpPlanManagerState } from "@/interface/home/AcpPlanManager";
import type { WorkerPlanSnapshot } from "@/shared/acp-plan";

const plan: WorkerPlanSnapshot = {
  runId: "run-1",
  workerId: "worker-1",
  acpSessionId: "session-1",
  planBoundarySeq: 1,
  lastEntrySeq: 2,
  lastAcceptedEntryId: "plan-2",
  visible: true,
  items: [{ id: "1:0", content: "Inspect", priority: "high", status: "in_progress", order: 0 }],
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function readyState(): AcpPlanManagerState {
  return {
    status: "ready",
    lastError: null,
    scope: {
      complete: true,
      runId: "run-1",
      workerIds: ["worker-1"],
      plansByWorkerId: { "worker-1": plan },
    },
  };
}

describe("ACP plan surface ownership", () => {
  it("owns the widget only for a ready, eligible, unambiguous primary worker", () => {
    expect(selectAcpPlanSurfaceOwner({
      runId: "run-1",
      workerIds: ["worker-1"],
      primaryWorkerId: "worker-1",
      eligibleConversationMode: true,
      workerIsTerminal: false,
      planState: readyState(),
    })).toMatchObject({
      ready: true,
      ownsWidget: true,
      suppressAcceptedPlanRows: true,
      plan,
    });
  });

  it("keeps transcript rows when ownership is loading or ambiguous", () => {
    const loading = { ...readyState(), status: "loading" as const };
    for (const input of [
      { workerIds: ["worker-1", "worker-2"], primaryWorkerId: "worker-1", planState: readyState() },
      { workerIds: ["worker-1"], primaryWorkerId: "worker-2", planState: readyState() },
      { workerIds: ["worker-1"], primaryWorkerId: "worker-1", planState: loading },
    ]) {
      expect(selectAcpPlanSurfaceOwner({
        runId: "run-1",
        eligibleConversationMode: true,
        workerIsTerminal: false,
        ...input,
      })).toMatchObject({ ownsWidget: false, suppressAcceptedPlanRows: false });
    }
  });

  it("does not own or suppress for ineligible or terminal conversations", () => {
    for (const input of [
      { eligibleConversationMode: false, workerIsTerminal: false },
      { eligibleConversationMode: true, workerIsTerminal: true },
    ]) {
      expect(selectAcpPlanSurfaceOwner({
        runId: "run-1",
        workerIds: ["worker-1"],
        primaryWorkerId: "worker-1",
        planState: readyState(),
        ...input,
      })).toMatchObject({ ownsWidget: false, suppressAcceptedPlanRows: false });
    }
  });
});
