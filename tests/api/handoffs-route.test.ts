import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandoffRecordDto } from "@/shared/handoff";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  launch: vi.fn(),
  cancel: vi.fn(),
  getActive: vi.fn(),
  getById: vi.fn(),
  revise: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({ requireApiSession: vi.fn().mockResolvedValue({ response: null }) }));
vi.mock("@/server/handoff/service", () => ({
  handoffCoordinator: { prepare: mocks.prepare, launch: mocks.launch, cancel: mocks.cancel },
  reviseHandoffAdvisory: mocks.revise,
}));
vi.mock("@/server/handoff/store", () => ({ getActiveHandoffForRun: mocks.getActive, getHandoffById: mocks.getById }));

import { handleHandoffLaunchRequest, handleRunHandoffsRequest } from "@/runtime/http/routes/handoffs";

function handoff(overrides: Partial<HandoffRecordDto> = {}): HandoffRecordDto {
  return {
    id: "handoff-1", sourceRunId: "run-1", sourceWorkerId: "worker-1", targetRunId: null,
    forkedFromMessageId: null, reason: "manual_session", status: "ready", revision: 2,
    sourceSeq: 10, workspaceFingerprint: "workspace", operationId: null,
    target: { workerType: "claude", model: null, effort: null, accountId: null }, packet: null,
    lastError: null, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), ...overrides,
  };
}

describe("cross-CLI handoff routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prepares a run-scoped handoff with a normalized target", async () => {
    mocks.prepare.mockResolvedValue(handoff());
    const response = await handleRunHandoffsRequest(new Request("http://localhost/api/runs/run-1/handoffs", {
      method: "POST",
      body: JSON.stringify({ reason: "manual_session", sourceWorkerId: "worker-1", target: { workerType: "claude-code", model: "opus" } }),
    }), { surface: "web", params: { id: "run-1" } });
    expect(response.status).toBe(201);
    expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({ sourceRunId: "run-1", target: expect.objectContaining({ workerType: "claude", model: "opus" }) }));
  });

  it("passes the revision and operation id to the launch claim", async () => {
    mocks.getById.mockResolvedValue(handoff());
    mocks.launch.mockResolvedValue(handoff({ status: "completed", targetRunId: "target-1", operationId: "op-1" }));
    const response = await handleHandoffLaunchRequest(new Request("http://localhost/api/handoffs/handoff-1/launch?runId=run-1", {
      method: "POST", body: JSON.stringify({ expectedRevision: 2, operationId: "op-1" }),
    }), { surface: "web", params: { id: "handoff-1" } });
    expect(response.status).toBe(200);
    expect(mocks.launch).toHaveBeenCalledWith({ handoffId: "handoff-1", expectedRevision: 2, operationId: "op-1" });
  });

  it("does not resolve a flat handoff id outside its declared source-run scope", async () => {
    mocks.getById.mockResolvedValue(handoff());
    const response = await handleHandoffLaunchRequest(new Request("http://localhost/api/handoffs/handoff-1/launch?runId=another-run", {
      method: "POST", body: JSON.stringify({ expectedRevision: 2, operationId: "op-1" }),
    }), { surface: "web", params: { id: "handoff-1" } });
    expect(response.status).toBe(404);
    expect(mocks.launch).not.toHaveBeenCalled();
  });
});
