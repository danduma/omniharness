import { describe, expect, it, vi } from "vitest";
import { HandoffManager } from "@/interface/home/HandoffManager";
import type { RuntimeAPIs } from "@/runtime-api/types";

describe("HandoffManager", () => {
  it("keeps preparation and launch in one durable manager state", async () => {
    const prepared = {
      id: "handoff-1", sourceRunId: "source", sourceWorkerId: "worker", targetRunId: null,
      forkedFromMessageId: null, reason: "manual_session" as const, status: "ready" as const, revision: 2,
      sourceSeq: 1, workspaceFingerprint: "workspace", operationId: null,
      target: { workerType: "claude" as const, model: null, effort: null, accountId: null }, packet: null,
      lastError: null, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    };
    const api = {
      getActive: vi.fn().mockResolvedValue({ handoff: null }),
      prepare: vi.fn().mockResolvedValue({ handoff: prepared }),
      revise: vi.fn(), get: vi.fn(), cancel: vi.fn(),
      launch: vi.fn().mockResolvedValue({ handoff: { ...prepared, status: "completed", targetRunId: "target" } }),
    } as unknown as RuntimeAPIs["handoffs"];
    const manager = new HandoffManager();
    manager.configure(api);
    manager.open({ runId: "source", workerId: "worker", sourceWorkerType: "codex", forkedFromMessageId: null, reason: "manual_session" });
    await manager.prepare();
    expect(manager.getSnapshot().handoff?.id).toBe("handoff-1");
    expect(await manager.launch()).toBe("target");
    expect(manager.getSnapshot().request).toBeNull();
  });

  it("ignores an active-draft response owned by a previously opened conversation", async () => {
    let resolveFirst!: (value: unknown) => void;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    const api = {
      getActive: vi.fn().mockImplementationOnce(() => first).mockResolvedValueOnce({ handoff: null }),
      prepare: vi.fn(), revise: vi.fn(), get: vi.fn(), cancel: vi.fn(), launch: vi.fn(),
    } as unknown as RuntimeAPIs["handoffs"];
    const manager = new HandoffManager();
    manager.configure(api);
    manager.open({ runId: "source-a", workerId: "worker-a", sourceWorkerType: "codex", forkedFromMessageId: null, reason: "manual_session" });
    manager.open({ runId: "source-b", workerId: "worker-b", sourceWorkerType: "claude", forkedFromMessageId: null, reason: "manual_session" });
    resolveFirst({ handoff: { id: "stale", sourceRunId: "source-a" } });
    await first;
    await Promise.resolve();
    expect(manager.getSnapshot().request?.runId).toBe("source-b");
    expect(manager.getSnapshot().handoff).toBeNull();
  });
});
