import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrchestrationManager, type OrchestrationApi } from "@/interface/orchestration/OrchestrationManager";
import { createDefaultOrchestrationPolicy } from "@/shared/orchestration-policy";
import type { WorkflowSnapshotDto } from "@/shared/orchestration-api";

function snapshot(overrides: Partial<WorkflowSnapshotDto> = {}): WorkflowSnapshotDto {
  const policy = createDefaultOrchestrationPolicy();
  return {
    runId: "run-1",
    profile: "balanced",
    profileSource: "default",
    locked: false,
    cancelled: false,
    policyVersion: 1,
    profilePolicy: policy.profiles.balanced,
    stages: [],
    budget: { reservedTokens: 0, reservedCostUsd: 0, settledTokens: 0, settledCostUsd: 0, committedTokens: 0, committedCostUsd: 0, unsettledStages: 0, unknownUsageStages: 0 },
    next: { kind: "dispatch", stage: "triage", attempt: 1, reason: "first" },
    triage: null,
    ...overrides,
  };
}

function api(overrides: Partial<Record<keyof OrchestrationApi, ReturnType<typeof vi.fn>>> = {}) {
  const policy = createDefaultOrchestrationPolicy();
  return {
    getPolicy: vi.fn().mockResolvedValue({ policy, defaults: policy }),
    savePolicy: vi.fn().mockImplementation(async ({ policy: saved }) => ({ ok: true, policy: saved })),
    preflight: vi.fn().mockResolvedValue({ ok: true, report: { runId: "", profile: "balanced", ready: true, stages: [] } }),
    getWorkflow: vi.fn().mockResolvedValue({ workflow: null }),
    act: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  } as unknown as OrchestrationApi & Record<string, ReturnType<typeof vi.fn>>;
}

let manager: OrchestrationManager;

beforeEach(() => {
  manager = new OrchestrationManager();
});

describe("OrchestrationManager", () => {
  it("loads the policy and compares profiles from the same draft", async () => {
    const client = api();
    await manager.loadPolicy(client);
    const state = manager.getSnapshot();
    expect(state.policyStatus).toBe("ready");
    expect(Object.keys(state.draft!.profiles)).toEqual(["economy", "balanced", "thorough", "custom"]);
    expect(manager.isDraftDirty()).toBe(false);
  });

  it("validates custom binding edits and refuses to save an invalid draft", async () => {
    const client = api();
    await manager.loadPolicy(client);
    manager.updateCustomBinding("code_review", { workerType: "codex" });
    expect(manager.getSnapshot().draftIssues.map((issue) => issue.code)).toContain("reviewer_not_independent");
    await manager.saveDraft(client);
    expect(client.savePolicy).not.toHaveBeenCalled();
    expect(manager.getSnapshot().saveStatus).toBe("error");

    manager.updateCustomBinding("code_review", { workerType: "claude" });
    expect(manager.getSnapshot().draftIssues).toEqual([]);
    manager.setDefaultProfile("thorough");
    expect(manager.isDraftDirty()).toBe(true);
    await manager.saveDraft(client);
    expect(client.savePolicy).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot()).toMatchObject({ saveStatus: "saved", savedPolicy: { defaultProfile: "thorough" } });
  });

  it("keeps secrets out of the draft model", async () => {
    const client = api();
    await manager.loadPolicy(client);
    manager.updateCustomBinding("plan", { model: ["sk", "test", "w".repeat(24)].join("-") });
    expect(manager.getSnapshot().draftIssues.map((issue) => issue.code)).toEqual(["secret_in_policy"]);
  });

  it("only allows starting after a ready preflight", async () => {
    const client = api({
      preflight: vi.fn()
        .mockResolvedValueOnce({ ok: true, report: { runId: "", profile: "thorough", ready: false, stages: [] } })
        .mockResolvedValueOnce({ ok: true, report: { runId: "", profile: "balanced", ready: true, stages: [] } }),
    });
    expect(manager.canStartWith("balanced")).toBe(false);
    await manager.runPreflight(client, "thorough");
    expect(manager.canStartWith("thorough")).toBe(false);
    await manager.runPreflight(client, "balanced");
    expect(manager.canStartWith("balanced")).toBe(true);
  });

  it("refreshes a watched workflow on orchestration events and coalesces concurrent loads", async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    const getWorkflow = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue({ workflow: snapshot({ next: { kind: "active", stage: "plan", attempt: 1 } }) });
    const client = api({ getWorkflow });
    const first = manager.loadWorkflow(client, "run-1");
    manager.onOrchestrationEvent({ runId: "run-1" });
    manager.onOrchestrationEvent({ runId: "run-1" });
    resolveFirst({ workflow: snapshot() });
    await first;
    await vi.waitFor(() => expect(manager.workflowFor("run-1").snapshot?.next.kind).toBe("active"));
    expect(getWorkflow).toHaveBeenCalledTimes(2);
    // Events for runs nobody watches are ignored.
    manager.onOrchestrationEvent({ runId: "run-unwatched" });
    expect(getWorkflow).toHaveBeenCalledTimes(2);
  });

  it("records typed refusals and conflicts from actions, then refreshes", async () => {
    const client = api({
      act: vi.fn()
        .mockResolvedValueOnce({ ok: false, refused: "profile_locked" })
        .mockResolvedValueOnce({ ok: false, result: { status: "conflict", stage: "plan" } }),
      getWorkflow: vi.fn().mockResolvedValue({ workflow: snapshot({ locked: true }) }),
    });
    await manager.act(client, "run-1", "select_profile", { profile: "economy" });
    expect(manager.workflowFor("run-1")).toMatchObject({ lastRefusal: "profile_locked", pendingAction: null, snapshot: { locked: true } });
    await manager.act(client, "run-1", "dispatch");
    expect(manager.workflowFor("run-1").lastRefusal).toBe("conflict");
  });

  it("starts a workflow by creating it on the chosen profile and dispatching", async () => {
    const client = api({ getWorkflow: vi.fn().mockResolvedValue({ workflow: snapshot() }) });
    manager.setStartProfile("run-1", "economy");
    await manager.startWorkflow(client, "run-1");
    expect(client.act).toHaveBeenNthCalledWith(1, { runId: "run-1", body: { action: "create", profile: "economy" } });
    expect(client.act).toHaveBeenNthCalledWith(2, { runId: "run-1", body: { action: "dispatch" } });
  });

  it("retries and cancels through the server, never by local state", async () => {
    const client = api({ getWorkflow: vi.fn().mockResolvedValue({ workflow: snapshot({ cancelled: true }) }) });
    await manager.act(client, "run-1", "retry");
    await manager.act(client, "run-1", "cancel");
    expect(client.act).toHaveBeenCalledWith({ runId: "run-1", body: { action: "retry" } });
    expect(client.act).toHaveBeenCalledWith({ runId: "run-1", body: { action: "cancel" } });
    expect(manager.workflowFor("run-1").snapshot?.cancelled).toBe(true);
  });
});
