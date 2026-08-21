import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { compileHybridHandoffPacket } from "@/server/handoff/compiler";

const originalRoot = process.env.OMNIHARNESS_ROOT;
let tempRoot = "";

function packet() {
  return compileHybridHandoffPacket({
    source: { runId: "run-1", workerId: null, workerType: "codex", forkedFromMessageId: null, sourceSeq: 1, interruptionReason: "manual_session", generatedAt: "2026-08-20T00:00:00.000Z" },
    target: { workerType: "claude", model: null, effort: null, accountId: null },
    projectRootLabel: "project",
    authoritative: { originalRequest: "task", currentObjective: "continue", modifiedFiles: [], verification: [], recentUserMessages: ["task"], queuedMessages: [] },
    advisory: { completed: [], remaining: ["continue"], blockers: [], openQuestions: [], decisions: [], relevantFiles: [], summarySource: "synthetic" },
  });
}

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-handoff-store-"));
  process.env.OMNIHARNESS_ROOT = tempRoot;
  vi.resetModules();
  const database = await import("@/server/db");
  await database.dbReady;
  const now = new Date();
  const schema = await import("@/server/db/schema");
  await database.db.insert(schema.plans).values({ id: "plan-1", path: "/tmp/plan", status: "running", createdAt: now, updatedAt: now });
  await database.db.insert(schema.runs).values({ id: "run-1", planId: "plan-1", mode: "direct", sessionType: "omni", projectPath: tempRoot, status: "running", createdAt: now, updatedAt: now });
});

afterEach(() => {
  if (originalRoot === undefined) delete process.env.OMNIHARNESS_ROOT;
  else process.env.OMNIHARNESS_ROOT = originalRoot;
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("handoff store", () => {
  it("persists a versioned packet and advances the metadata revision", async () => {
    const store = await import("@/server/handoff/store");
    const draft = await store.createHandoffDraft({
      id: "handoff-1",
      sourceRunId: "run-1",
      sourceWorkerId: null,
      forkedFromMessageId: null,
      normalizedProjectPath: tempRoot,
      reason: "manual_session",
      target: { workerType: "claude", model: null, effort: null, accountId: null },
      targetSelectionHash: "selection",
    });
    expect(draft.revision).toBe(1);

    const saved = await store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: 1, packet: packet(), workspaceFingerprint: "workspace" });
    expect(saved.revision).toBe(2);
    expect(saved.status).toBe("ready");
    expect((await store.getHandoffById(draft.id))?.packet?.contentHash).toBe(packet().contentHash);
  });

  it("rejects stale packet revisions", async () => {
    const store = await import("@/server/handoff/store");
    const draft = await store.createHandoffDraft({ id: "handoff-2", sourceRunId: "run-1", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
    await store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: 1, packet: packet(), workspaceFingerprint: "workspace" });
    await expect(store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: 1, packet: packet(), workspaceFingerprint: "workspace" })).rejects.toMatchObject({ code: "handoff_revision_conflict" });
  });

  it("allows only one launch claim for the same ready revision", async () => {
    const store = await import("@/server/handoff/store");
    const draft = await store.createHandoffDraft({ id: "handoff-claim", sourceRunId: "run-1", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
    const ready = await store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: 1, packet: packet(), workspaceFingerprint: "workspace" });
    const results = await Promise.allSettled([
      store.transitionHandoff({ handoffId: ready.id, expectedRevision: ready.revision, from: ["ready"], to: "launching", operationId: "one", launchClaimToken: "one" }),
      store.transitionHandoff({ handoffId: ready.id, expectedRevision: ready.revision, from: ["ready"], to: "launching", operationId: "two", launchClaimToken: "two" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("serializes concurrent packet writes before appending artifact versions", async () => {
    const store = await import("@/server/handoff/store");
    const draft = await store.createHandoffDraft({ id: "handoff-packet-race", sourceRunId: "run-1", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
    const results = await Promise.allSettled([
      store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: 1, packet: packet(), workspaceFingerprint: "workspace" }),
      store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: 1, packet: packet(), workspaceFingerprint: "workspace" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const metadataStore = await import("@/server/artifacts/stream-metadata");
    const artifactStore = await import("@/server/artifacts/append-only-store");
    const metadata = await metadataStore.readArtifactStreamMetadata({ runId: "run-1", kind: "handoff_packets", ownerId: null });
    expect(metadata?.latestSeq).toBe(1);
    const location = await artifactStore.resolveArtifactStreamLocation({ runId: "run-1", kind: "handoff_packets", ownerId: null, projectPath: metadata!.projectPath }, "read");
    expect(await artifactStore.readAllArtifactEntries(location)).toHaveLength(1);
  });

  it("completes the handoff, source cancellation, fence release, and queued cancellation atomically", async () => {
    const store = await import("@/server/handoff/store");
    const database = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const now = new Date();
    await database.db.insert(schema.runs).values({ id: "target-1", planId: "plan-1", mode: "direct", sessionType: "omni", projectPath: tempRoot, status: "running", createdAt: now, updatedAt: now });
    await database.db.insert(schema.queuedConversationMessages).values({ id: "queued-1", runId: "run-1", targetWorkerId: null, action: "message", content: "continue", status: "pending", createdAt: now, updatedAt: now });
    const draft = await store.createHandoffDraft({ id: "handoff-complete", sourceRunId: "run-1", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
    const ready = await store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: draft.revision, packet: packet(), workspaceFingerprint: "workspace" });
    const launching = await store.transitionHandoff({ handoffId: ready.id, expectedRevision: ready.revision, from: ["ready"], to: "launching", operationId: "op", launchClaimToken: "claim" });
    const completed = await store.completeHandoffLaunch({ handoffId: launching.id, expectedRevision: launching.revision, sourceRunId: "run-1", targetRunId: "target-1" });
    const source = await database.db.select().from(schema.runs).where(eq(schema.runs.id, "run-1")).get();
    const queued = await database.db.select().from(schema.queuedConversationMessages).where(eq(schema.queuedConversationMessages.id, "queued-1")).get();
    expect(completed).toMatchObject({ status: "completed", targetRunId: "target-1" });
    expect(source).toMatchObject({ status: "cancelled", activeHandoffId: null });
    expect(queued).toMatchObject({ status: "cancelled", lastError: "cross_cli_handoff" });
  });

  it("keeps needs-recovery handoffs inside the database uniqueness fence", async () => {
    const store = await import("@/server/handoff/store");
    const database = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const draft = await store.createHandoffDraft({ id: "handoff-unsafe", sourceRunId: "run-1", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
    const ready = await store.saveHandoffPacket({ handoffId: draft.id, expectedRevision: draft.revision, packet: packet(), workspaceFingerprint: "workspace" });
    const launching = await store.transitionHandoff({ handoffId: ready.id, expectedRevision: ready.revision, from: ["ready"], to: "launching" });
    await store.transitionHandoff({ handoffId: launching.id, expectedRevision: launching.revision, from: ["launching"], to: "needs_recovery" });
    const now = new Date();
    await expect(database.db.insert(schema.conversationHandoffs).values({
      id: "handoff-duplicate",
      sourceRunId: "run-1",
      sourceWorkerId: null,
      forkedFromMessageId: null,
      reason: "manual_session",
      status: "capturing",
      revision: 1,
      normalizedProjectPath: tempRoot,
      targetWorkerType: "gemini",
      targetSelectionHash: "other",
      createdAt: now,
      updatedAt: now,
    })).rejects.toThrow();
  });
});
