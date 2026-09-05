import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAllocateWorkerAccount, mockAskAgent, mockCancelAgent, mockReadRuntimeEnv, mockSpawnAgent } = vi.hoisted(() => ({
  mockAllocateWorkerAccount: vi.fn(),
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockReadRuntimeEnv: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/accounts/account-allocator", () => ({ allocateWorkerAccount: mockAllocateWorkerAccount }));
vi.mock("@/server/bridge-client", () => ({ askAgent: mockAskAgent, cancelAgent: mockCancelAgent, spawnAgent: mockSpawnAgent }));
vi.mock("@/server/supervisor/runtime-settings", () => ({ readRuntimeEnvFromSettings: mockReadRuntimeEnv }));

import { summarizeHandoffWithTarget } from "@/server/handoff/target-summarizer";
import type { HybridHandoffPacketV1 } from "@/shared/handoff";

const packet = {
  handoffVersion: 1,
  contentHash: "packet-hash",
  task: { originalRequest: "Fix exports", currentObjective: "Add Safari coverage" },
} as HybridHandoffPacketV1;

describe("summarizeHandoffWithTarget", () => {
  beforeEach(() => {
    mockAllocateWorkerAccount.mockReset().mockResolvedValue({ account: { id: "account-target" } });
    mockReadRuntimeEnv.mockReset().mockResolvedValue({ env: { TARGET_TOKEN: "secret" }, decryptionFailures: [] });
    mockSpawnAgent.mockReset().mockResolvedValue({ state: "idle" });
    mockCancelAgent.mockReset().mockResolvedValue(undefined);
    mockAskAgent.mockReset().mockResolvedValue({
      response: "```omniharness-handoff\nTASK: Add Safari coverage\nPROGRESS: Confirmed Safari fallback\nNEXT_STEPS: Add regression test\nBLOCKERS: none\nOPEN_QUESTIONS: none\nRELEVANT_FILES: src/export.ts\n```",
      state: "idle",
    });
  });

  it("runs a disposable read-only target CLI and returns its structured brief", async () => {
    const advisory = await summarizeHandoffWithTarget({
      handoffId: "handoff-123456789",
      sourceRunId: "source-run",
      projectPath: "/project",
      target: { workerType: "claude", model: "opus", effort: "high", accountId: null },
      packet,
    });

    const agentId = mockSpawnAgent.mock.calls[0]?.[0]?.name as string;
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({ type: "claude", model: "opus", effort: "high", mode: "read-only", accountId: "account-target" }));
    expect(agentId).toMatch(/^handoff-summary-/);
    expect(mockAskAgent).toHaveBeenCalledWith(agentId, expect.stringContaining('"currentObjective": "Add Safari coverage"'), undefined, expect.any(Object));
    expect(mockCancelAgent).toHaveBeenCalledWith(agentId);
    expect(advisory).toMatchObject({
      completed: ["Confirmed Safari fallback"],
      remaining: ["Add regression test"],
      relevantFiles: ["src/export.ts"],
      summarySource: "target_summarizer",
    });
  });

  it("instructs the summarizer to explain edits and reserve blockers for actual impediments", async () => {
    await summarizeHandoffWithTarget({
      handoffId: "handoff-123456789",
      sourceRunId: "source-run",
      projectPath: "/project",
      target: { workerType: "claude", model: "opus", effort: "high", accountId: null },
      packet,
    });

    const prompt = String(mockAskAgent.mock.calls[0]?.[1] ?? "");
    expect(prompt).toContain("successful edit-tool evidence");
    expect(prompt).toContain("Do not repeat the current objective as progress");
    expect(prompt).toContain("not a blocker");
  });

  it("normalizes the summarizer's none sentinel to an empty relevant-file list", async () => {
    mockAskAgent.mockResolvedValue({
      response: "```omniharness-handoff\nTASK: Add Safari coverage\nPROGRESS: Confirmed Safari fallback\nNEXT_STEPS: Add regression test\nBLOCKERS: none\nOPEN_QUESTIONS: none\nRELEVANT_FILES: none\n```",
      state: "idle",
    });

    const advisory = await summarizeHandoffWithTarget({
      handoffId: "handoff-123456789",
      sourceRunId: "source-run",
      projectPath: "/project",
      target: { workerType: "claude", model: "opus", effort: "high", accountId: null },
      packet,
    });

    expect(advisory.relevantFiles).toEqual([]);
  });

  it("refuses preparation and still stops the temporary CLI when its report is invalid", async () => {
    mockAskAgent.mockResolvedValue({ response: "not a handoff report", state: "idle" });

    await expect(summarizeHandoffWithTarget({
      handoffId: "handoff-123456789",
      sourceRunId: "source-run",
      projectPath: "/project",
      target: { workerType: "codex", model: null, effort: null, accountId: null },
      packet,
    })).rejects.toThrow("invalid report");

    expect(mockCancelAgent).toHaveBeenCalledTimes(1);
  });
});
