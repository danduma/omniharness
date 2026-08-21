import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, ne } from "drizzle-orm";

const originalRoot = process.env.OMNIHARNESS_ROOT;
let tempRoot = "";

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-handoff-stop-"));
  process.env.OMNIHARNESS_ROOT = tempRoot;
  vi.resetModules();
  vi.doMock("@/server/bridge-client", () => ({
    askAgent: vi.fn(),
    cancelAgent: vi.fn().mockRejectedValue(Object.assign(new Error("bridge transport unavailable"), { status: 503 })),
    getAgent: vi.fn().mockRejectedValue(Object.assign(new Error("bridge transport unavailable"), { status: 503 })),
  }));
  vi.doMock("@/server/supervisor/worker-availability", () => ({ isSpawnableWorkerType: () => ({ ok: true }) }));
  vi.doMock("@/server/quota/type-blocking", () => ({ isWorkerTypeQuotaBlocked: async () => false }));
  const database = await import("@/server/db");
  await database.dbReady;
  const schema = await import("@/server/db/schema");
  const now = new Date();
  await database.db.insert(schema.plans).values({ id: "plan-stop", path: "/tmp/plan", status: "running", createdAt: now, updatedAt: now });
  await database.db.insert(schema.runs).values({ id: "run-stop", planId: "plan-stop", mode: "direct", sessionType: "omni", projectPath: tempRoot, status: "running", createdAt: now, updatedAt: now });
  await database.db.insert(schema.workers).values({ id: "worker-stop", runId: "run-stop", type: "codex", status: "working", cwd: tempRoot, title: "source", initialPrompt: "task", outputLog: "", outputEntriesJson: "", currentText: "", lastText: "", createdAt: now, updatedAt: now });
});

afterEach(() => {
  vi.doUnmock("@/server/bridge-client");
  vi.doUnmock("@/server/supervisor/worker-availability");
  vi.doUnmock("@/server/quota/type-blocking");
  if (originalRoot === undefined) delete process.env.OMNIHARNESS_ROOT;
  else process.env.OMNIHARNESS_ROOT = originalRoot;
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("handoff source stop confirmation", () => {
  it("does not treat an ambiguous bridge transport failure as proof that the source stopped", async () => {
    const { handoffCoordinator } = await import("@/server/handoff/service");
    await expect(handoffCoordinator.prepare({
      sourceRunId: "run-stop",
      sourceWorkerId: "worker-stop",
      forkedFromMessageId: null,
      reason: "manual_session",
      target: { workerType: "claude", model: null, effort: null, accountId: null },
    })).rejects.toThrow("bridge transport unavailable");

    const database = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const target = await database.db.select().from(schema.runs).where(ne(schema.runs.id, "run-stop")).get();
    const handoff = await database.db.select().from(schema.conversationHandoffs).where(eq(schema.conversationHandoffs.sourceRunId, "run-stop")).get();
    expect(target).toBeUndefined();
    expect(handoff?.status).toBe("failed");
  });

  it("drains admitted recovery, stops its replacement worker, and captures that worker", async () => {
    const bridge = await import("@/server/bridge-client");
    vi.mocked(bridge.cancelAgent).mockResolvedValue({ ok: true } as never);
    vi.mocked(bridge.getAgent).mockResolvedValue({ state: "stopped" } as never);
    const database = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const { runConversationMutation } = await import("@/server/conversations/worker-turn-gate");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let mutationEntered = false;
    const recovery = runConversationMutation("run-stop", async () => {
      mutationEntered = true;
      await gate;
      const createdAt = new Date(Date.now() + 1_000);
      await database.db.insert(schema.workers).values({
        id: "worker-replacement",
        runId: "run-stop",
        type: "codex",
        status: "working",
        cwd: tempRoot,
        title: "replacement",
        initialPrompt: "recovered task",
        outputLog: "",
        outputEntriesJson: "",
        currentText: "",
        lastText: "",
        createdAt,
        updatedAt: createdAt,
      });
    });
    await vi.waitFor(() => expect(mutationEntered).toBe(true));

    const { handoffCoordinator } = await import("@/server/handoff/service");
    const preparing = handoffCoordinator.prepare({
      sourceRunId: "run-stop",
      sourceWorkerId: "worker-stop",
      forkedFromMessageId: null,
      reason: "manual_session",
      target: { workerType: "claude", model: null, effort: null, accountId: null },
    });
    await vi.waitFor(async () => {
      const handoff = await database.db.select().from(schema.conversationHandoffs).where(eq(schema.conversationHandoffs.sourceRunId, "run-stop")).get();
      expect(handoff?.status).toBe("capturing");
    });
    release();
    await recovery;

    const handoff = await preparing;
    expect(bridge.cancelAgent).toHaveBeenCalledWith("worker-stop");
    expect(bridge.cancelAgent).toHaveBeenCalledWith("worker-replacement");
    expect(handoff.sourceWorkerId).toBe("worker-replacement");
    expect(handoff.packet?.source.workerId).toBe("worker-replacement");
  });
});
