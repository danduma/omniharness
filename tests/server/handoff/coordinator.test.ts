import { describe, expect, it, vi } from "vitest";
import { createHandoffCoordinator, type HandoffCoordinatorDependencies } from "@/server/handoff/coordinator";
import type { HandoffRecordDto, HybridHandoffPacketV1 } from "@/shared/handoff";

function record(overrides: Partial<HandoffRecordDto> = {}): HandoffRecordDto {
  return {
    id: "handoff-1",
    sourceRunId: "source",
    sourceWorkerId: "worker-source",
    targetRunId: null,
    forkedFromMessageId: null,
    reason: "manual_session",
    status: "capturing",
    revision: 1,
    sourceSeq: 10,
    workspaceFingerprint: "workspace",
    operationId: null,
    target: { workerType: "claude", model: null, effort: null, accountId: null },
    packet: null,
    lastError: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function dependencies(calls: string[]): HandoffCoordinatorDependencies {
  const ready = record({ status: "ready", revision: 2, packet: { contentHash: "packet" } as HybridHandoffPacketV1 });
  return {
    now: () => new Date("2026-08-20T00:00:00.000Z"),
    randomId: () => "generated-id",
    getSource: async () => ({ run: { id: "source", mode: "direct", projectPath: "/tmp/project", status: "running", gitBaselineJson: null }, worker: { id: "worker-source", type: "codex", status: "working", bridgeSessionId: "session" } }),
    validateTarget: async () => { calls.push("validate"); },
    createDraft: async () => { calls.push("draft"); return record(); },
    requestAdvisory: async () => null,
    terminateSource: async () => { calls.push("terminate"); return { confirmed: true }; },
    gatherCandidates: async () => { calls.push("gather"); return { sourceSeq: 10, workspace: { fingerprint: "workspace" } } as never; },
    compilePacket: () => ({ contentHash: "packet" } as HybridHandoffPacketV1),
    savePacket: async () => { calls.push("save"); return ready; },
    markSourcePrepared: async () => { calls.push("prepared"); },
    getHandoff: async () => ready,
    getSourceFence: async () => ({ sourceSeq: 10, workspaceFingerprint: "workspace" }),
    claimLaunch: async () => { calls.push("claim"); return record({ ...ready, status: "launching", revision: 3 }); },
    launchTarget: async () => { calls.push("launch"); return { runId: "target", workerId: "target-worker" }; },
    completeLaunch: async () => { calls.push("complete"); return record({ ...ready, status: "completed", revision: 4, targetRunId: "target" }); },
    settleFailure: async () => { calls.push("settle"); },
    cancelHandoff: async () => record({ status: "cancelled" }),
    emit: vi.fn(),
  };
}

describe("handoff coordinator", () => {
  it("confirms source termination before gathering final state and allowing target launch", async () => {
    const calls: string[] = [];
    const coordinator = createHandoffCoordinator(dependencies(calls));
    const prepared = await coordinator.prepare({ sourceRunId: "source", sourceWorkerId: "worker-source", forkedFromMessageId: null, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null } });
    expect(prepared.status).toBe("ready");
    expect(calls.indexOf("terminate")).toBeLessThan(calls.indexOf("gather"));

    await coordinator.launch({ handoffId: prepared.id, expectedRevision: prepared.revision, operationId: "op" });
    expect(calls.indexOf("terminate")).toBeLessThan(calls.indexOf("launch"));
    expect(calls.indexOf("claim")).toBeLessThan(calls.indexOf("launch"));
  });

  it("refuses launch on source drift without creating a target", async () => {
    const calls: string[] = [];
    const deps = dependencies(calls);
    deps.getSourceFence = async () => ({ sourceSeq: 11, workspaceFingerprint: "changed" });
    const coordinator = createHandoffCoordinator(deps);
    await expect(coordinator.launch({ handoffId: "handoff-1", expectedRevision: 2, operationId: "op" })).rejects.toMatchObject({ code: "handoff_source_changed" });
    expect(calls).not.toContain("launch");
    expect(calls).toContain("settle");
  });

  it("adopts a concurrent durable completion instead of reopening the source", async () => {
    const calls: string[] = [];
    const deps = dependencies(calls);
    deps.completeLaunch = async () => { throw new Error("revision changed during completion"); };
    deps.settleFailure = async () => record({ status: "completed", revision: 4, targetRunId: "target", operationId: "op" });
    const coordinator = createHandoffCoordinator(deps);

    const result = await coordinator.launch({ handoffId: "handoff-1", expectedRevision: 2, operationId: "op" });

    expect(result).toMatchObject({ status: "completed", targetRunId: "target" });
  });
});
