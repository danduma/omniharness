import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const originalRoot = process.env.OMNIHARNESS_ROOT;
let tempRoot = "";

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-handoff-fence-"));
  process.env.OMNIHARNESS_ROOT = tempRoot;
  vi.resetModules();
  const { db, dbReady } = await import("@/server/db");
  await dbReady;
  const schema = await import("@/server/db/schema");
  const now = new Date();
  await db.insert(schema.plans).values({ id: "plan", path: "/tmp/plan", status: "running", createdAt: now, updatedAt: now });
  await db.insert(schema.runs).values([
    { id: "source", planId: "plan", mode: "direct", sessionType: "omni", projectPath: tempRoot, status: "running", createdAt: now, updatedAt: now },
    { id: "other", planId: "plan", mode: "direct", sessionType: "omni", projectPath: tempRoot, status: "running", createdAt: now, updatedAt: now },
  ]);
});

afterEach(() => {
  if (originalRoot === undefined) delete process.env.OMNIHARNESS_ROOT;
  else process.env.OMNIHARNESS_ROOT = originalRoot;
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("handoff workspace fence", () => {
  it("blocks another run in the leased checkout and ignores stale terminal markers", async () => {
    const store = await import("@/server/handoff/store");
    const fence = await import("@/server/handoff/fence");
    const draft = await store.createHandoffDraft({ id: "handoff", sourceRunId: "source", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
    await expect(fence.assertRunNotHandoffFenced("other")).rejects.toMatchObject({ code: "handoff_in_progress", handoffId: draft.id });
    const cancelled = await store.transitionHandoff({ handoffId: draft.id, expectedRevision: draft.revision, from: ["capturing"], to: "cancelled" });
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    await db.update(schema.runs).set({ activeHandoffId: cancelled.id }).where(eq(schema.runs.id, "source"));
    await expect(fence.assertRunNotHandoffFenced("source")).resolves.toBeUndefined();
  });

  it("atomically admits source mutations and drains pre-fence work", async () => {
    const store = await import("@/server/handoff/store");
    const { runConversationMutation, waitForConversationMutations } = await import("@/server/conversations/worker-turn-gate");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let entered = false;
    const admitted = runConversationMutation("source", async () => {
      entered = true;
      await gate;
    });
    await vi.waitFor(() => expect(entered).toBe(true));
    await store.createHandoffDraft({ id: "handoff-race", sourceRunId: "source", sourceWorkerId: null, forkedFromMessageId: null, normalizedProjectPath: tempRoot, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null }, targetSelectionHash: "selection" });
    await expect(runConversationMutation("source", async () => undefined)).rejects.toMatchObject({ code: "handoff_in_progress" });
    release();
    await admitted;
    await expect(waitForConversationMutations("source")).resolves.toBeUndefined();
  });
});
