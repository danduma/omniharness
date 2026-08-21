import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { compileHybridHandoffPacket, renderHybridHandoffSeed } from "@/server/handoff/compiler";

const originalRoot = process.env.OMNIHARNESS_ROOT;
let tempRoot = "";
let mockGetAgent = vi.fn();

function packet() {
  return compileHybridHandoffPacket({
    source: { runId: "source", workerId: null, workerType: "codex", forkedFromMessageId: null, sourceSeq: null, interruptionReason: "manual_session", generatedAt: "2026-08-20T00:00:00.000Z" },
    target: { workerType: "claude", model: null, effort: null, accountId: null },
    projectRootLabel: "project",
    authoritative: { originalRequest: "task", currentObjective: "continue", modifiedFiles: [], verification: [], recentUserMessages: ["task"], queuedMessages: [] },
    advisory: { completed: [], remaining: ["continue"], blockers: [], openQuestions: [], decisions: [], relevantFiles: [], summarySource: "synthetic" },
  });
}

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-handoff-reconcile-"));
  process.env.OMNIHARNESS_ROOT = tempRoot;
  vi.resetModules();
  mockGetAgent = vi.fn().mockRejectedValue(Object.assign(new Error("agent missing"), { status: 404 }));
  vi.doMock("@/server/bridge-client", () => ({
    askAgent: vi.fn(),
    cancelAgent: vi.fn().mockResolvedValue(undefined),
    getAgent: mockGetAgent,
  }));
  const database = await import("@/server/db");
  await database.dbReady;
  const schema = await import("@/server/db/schema");
  const now = new Date();
  await database.db.insert(schema.plans).values({ id: "plan", path: "/tmp/plan", status: "running", createdAt: now, updatedAt: now });
  await database.db.insert(schema.runs).values({ id: "source", planId: "plan", mode: "direct", sessionType: "omni", projectPath: tempRoot, status: "needs_recovery", createdAt: now, updatedAt: now });
});

afterEach(() => {
  vi.doUnmock("@/server/bridge-client");
  if (originalRoot === undefined) delete process.env.OMNIHARNESS_ROOT;
  else process.env.OMNIHARNESS_ROOT = originalRoot;
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function seedLaunchingTarget(workerStatus: string) {
  const store = await import("@/server/handoff/store");
  const database = await import("@/server/db");
  const schema = await import("@/server/db/schema");
  const now = new Date();
  const draft = await store.createHandoffDraft({ id: "handoff", sourceRunId: "source", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
  const ready = await store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: draft.revision, packet: packet(), workspaceFingerprint: "workspace" });
  const launching = await store.transitionHandoff({ handoffId: ready.id, expectedRevision: ready.revision, from: ["ready"], to: "launching", operationId: "op", launchClaimToken: "claim", claimExpiresAt: new Date(Date.now() - 1_000) });
  await database.db.insert(schema.runs).values({ id: "target", planId: "plan", mode: "direct", sessionType: "omni", projectPath: tempRoot, parentRunId: "source", originHandoffId: "handoff", status: workerStatus === "error" ? "failed" : "running", createdAt: now, updatedAt: now });
  const seed = renderHybridHandoffSeed(packet(), "testnonce");
  await database.db.insert(schema.workers).values({ id: "target-worker", runId: "target", type: "claude", status: workerStatus, cwd: tempRoot, title: "target", initialPrompt: seed, outputLog: "", outputEntriesJson: "", currentText: "", lastText: "", createdAt: now, updatedAt: now });
  if (workerStatus !== "starting") {
    const { appendLifecycleEntry, appendUserInputOnDelivery } = await import("@/server/workers/stream-writer");
    await appendUserInputOnDelivery({ id: "target-input", runId: "target", workerId: "target-worker", text: seed, deliveredAt: now, attachments: [] });
    await appendLifecycleEntry({ runId: "target", workerId: "target-worker", text: "accepted", raw: { eventType: "worker.prompt_accepted" } });
  }
  return launching;
}

describe("expired handoff reconciliation", () => {
  it("adopts only a target with a persisted seed and accepted worker launch", async () => {
    await seedLaunchingTarget("working");
    mockGetAgent.mockResolvedValue({ state: "idle" });
    const { reconcileExpiredHandoffs } = await import("@/server/handoff/reconciler");
    await reconcileExpiredHandoffs(new Date());
    const database = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    expect(await database.db.select().from(schema.conversationHandoffs).where(eq(schema.conversationHandoffs.id, "handoff")).get()).toMatchObject({ status: "completed", targetRunId: "target" });
    expect(await database.db.select().from(schema.runs).where(eq(schema.runs.id, "source")).get()).toMatchObject({ status: "cancelled", activeHandoffId: null });
  });

  it("fails an incomplete target instead of manufacturing launch success", async () => {
    await seedLaunchingTarget("starting");
    const { reconcileExpiredHandoffs } = await import("@/server/handoff/reconciler");
    await reconcileExpiredHandoffs(new Date());
    const database = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    expect(await database.db.select().from(schema.conversationHandoffs).where(eq(schema.conversationHandoffs.id, "handoff")).get()).toMatchObject({ status: "failed", lastError: "handoff_target_incomplete" });
    expect(await database.db.select().from(schema.runs).where(eq(schema.runs.id, "target")).get()).toMatchObject({ status: "failed" });
  });

  it("keeps both conversations fenced when a partial target cannot be confirmed stopped", async () => {
    await seedLaunchingTarget("working");
    mockGetAgent.mockRejectedValue(new Error("bridge transport unavailable"));
    const { reconcileExpiredHandoffs } = await import("@/server/handoff/reconciler");
    await reconcileExpiredHandoffs(new Date());
    const database = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    expect(await database.db.select().from(schema.conversationHandoffs).where(eq(schema.conversationHandoffs.id, "handoff")).get()).toMatchObject({ status: "needs_recovery", targetRunId: "target" });
    expect(await database.db.select().from(schema.runs).where(eq(schema.runs.id, "source")).get()).toMatchObject({ status: "needs_recovery", activeHandoffId: "handoff" });
    const { assertRunNotHandoffFenced } = await import("@/server/handoff/fence");
    await expect(assertRunNotHandoffFenced("source")).rejects.toMatchObject({ code: "handoff_in_progress" });
    await expect(assertRunNotHandoffFenced("target")).rejects.toMatchObject({ code: "handoff_in_progress" });
  });
});
